import dayjs from "dayjs";
import { db } from "../database/database.connection.js";

export async function createRental(req, res) {
  const { customerId, gameId, daysRented } = req.body;

  try {
    const customer = await db.query(
      `
        SELECT * from customers WHERE id = $1;`,
      [customerId]
    );
    if (customer.rowCount === 0)
      return res
        .status(400)
        .send({ message: "Id inválido, cliente não cadastrado!" });

    const result = await db.query(
      `
          SELECT * from games WHERE id = $1;`,
      [gameId]
    );
    if (result.rowCount === 0)
      return res
        .status(400)
        .send({ message: "Id inválido, jogo não cadastrado!" });

    const game = result.rows[0];

    const rentals = await db.query(
      `
        SELECT * from rentals
        WHERE "gameId" = $1;
    `,
      [gameId]
    );
    if (rentals.rowCount >= game.stockTotal)
      return res.status(400).send({
        message: `Todas as unidades do jogo ${game.name} já estão alugadas!`,
      });

    const rentDate = dayjs(Date.now()).format("YYYY-MM-DD");
    const originalPrice = daysRented * game.pricePerDay;

    await db.query(
      `INSERT INTO rentals ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee")
        VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [customerId, gameId, rentDate, daysRented, null, originalPrice, null]
    );

    return res.sendStatus(201);
  } catch (err) {
    console.log(err.message);
    return res.status(500).send(err.message);
  }
}

export async function getRentals(req, res) {
  const { customerId, gameId, offset, limit, order, desc, status, startDate } =
    req.query;

  try {
    let query = `SELECT rentals.id, rentals."customerId", rentals."gameId", 
    rentals."daysRented", rentals."originalPrice", rentals."delayFee", 
    customers.name AS "customerName", games.name AS "gameName",
      TO_CHAR("rentDate", 'YYYY-MM-DD') AS "rentDate",
      TO_CHAR("returnDate", 'YYYY-MM-DD') AS "returnDate"
      FROM rentals
      JOIN customers ON rentals."customerId" = customers.id
      JOIN games ON rentals."gameId" = games.id`;

    let hasAtLeastOneCondition = false;

    if (customerId) {
      query += ` WHERE rentals."customerId" = ${customerId}`;
      hasAtLeastOneCondition = true;
    }

    if (gameId) {
      query += ` WHERE rentals."gameId" = ${gameId}`;
      hasAtLeastOneCondition = true;
    }

    if (status === "open") {
      query += hasAtLeastOneCondition
        ? ` AND rentals."returnDate" = null`
        : ` WHERE rentals."returnDate" = null`;
      hasAtLeastOneCondition = true;
    }

    if (status === "closed") {
      query += hasAtLeastOneCondition
        ? ` AND rentals."returnDate" != null`
        : ` WHERE rentals."returnDate" != null`;
      hasAtLeastOneCondition = true;
    }

    if (startDate) {
      query += hasAtLeastOneCondition
        ? ` AND rentals."rentDate" >= '${startDate}'`
        : ` WHERE rentals."rentDate" >= '${startDate}'`;
    }

    if (offset) query += ` OFFSET ${offset}`;

    if (limit) query += ` LIMIT ${limit}`;

    if (order) query += ` ORDER BY "${order}"`;

    if (order && desc) query += ` DESC`;
    
    const result = await db.query(query);

    const rentals = result.rows.map((row) => {
      const customer = {
        id: row.customerId,
        name: row.customerName,
      };
      const game = {
        id: row.gameId,
        name: row.gameName,
      };
      const rental = {
        ...row,
        customer,
        game,
      };
      delete rental.customerName;
      delete rental.gameName;

      return rental;
    });

    return res.send(rentals);
  } catch (err) {
    console.log(err.message);
    return res.status(500).send(err.message);
  }
}

export async function concludeRental(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT rentals."daysRented", rentals."delayFee", 
        games."pricePerDay" AS "gamePrice",
        TO_CHAR("rentDate", 'YYYY-MM-DD') AS "rentDate",
        TO_CHAR("returnDate", 'YYYY-MM-DD') AS "returnDate"
        FROM rentals
        JOIN games ON rentals."gameId" = games.id
        WHERE rentals.id = $1;`,
      [id]
    );

    if (result.rowCount === 0)
      return res.status(404).send({
        message: "O aluguel com id fornecido não existe!",
      });

    const rental = result.rows[0];

    if (rental.returnDate !== null)
      return res.status(400).send({
        message: "O aluguel com id fornecido já foi finalizado!",
      });

    const now = Date.now();
    const formattedNow = dayjs(now).format("YYYY-MM-DD");
    const deliveryDate = dayjs(rental.rentDate).add(rental.daysRented, "day");
    const delayInDays = deliveryDate.diff(formattedNow, "day");
    let delayFee = 0;
    if (delayInDays < 0) delayFee = Math.abs(delayInDays) * rental.gamePrice;

    await db.query(
      `UPDATE rentals
        SET "returnDate" = $2, "delayFee" = $3
        WHERE id = $1;`,
      [id, formattedNow, delayFee]
    );

    return res.sendStatus(200);
  } catch (err) {
    console.log(err.message);
    return res.status(500).send(err.message);
  }
}

export async function deleteRental(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT rentals."returnDate", 
        TO_CHAR("returnDate", 'YYYY-MM-DD') AS "returnDate"
        FROM rentals
        WHERE rentals.id = $1;`,
      [id]
    );

    if (result.rowCount === 0)
      return res.status(404).send({
        message: "O aluguel com id fornecido não existe!",
      });

    const rental = result.rows[0];

    if (rental.returnDate === null)
      return res.status(400).send({
        message: "O aluguel com id fornecido ainda não foi finalizado!",
      });

    await db.query(
      `DELETE FROM rentals
        WHERE id = $1;`,
      [id]
    );

    return res.sendStatus(200);
  } catch (err) {
    console.log(err.message);
    return res.status(500).send(err.message);
  }
}
