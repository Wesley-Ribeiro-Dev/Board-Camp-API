import { db } from "../database/database.connection.js";

export async function createCustomer(req, res) {
  const { name, phone, cpf, birthday } = req.body;

  try {
    const result = await db.query(
      `
        SELECT * from customers WHERE cpf = $1;`,
      [cpf]
    );
    if (result.rowCount > 0)
      return res.status(409).send({ message: "Cliente já cadastrado!" });

    await db.query(
      `INSERT INTO customers (name, phone, cpf, birthday)
        VALUES ($1, $2, $3, $4);`,
      [name, phone, cpf, birthday]
    );

    return res.sendStatus(201);
  } catch (err) {
    console.log(err.message);
    return res.status(500).send(err.message);
  }
}

export async function getCustomers(req, res) {
  const { cpf, offset, limit, order, desc } = req.query;

  try {
    let query =
      "SELECT id, name, phone, cpf, TO_CHAR(birthday, 'YYYY-MM-DD') AS birthday FROM customers";

    if (cpf) query += ` WHERE cpf LIKE '${cpf}%'`;

    if (offset) query += ` OFFSET ${offset}`;

    if (limit) query += ` LIMIT ${limit}`;

    if (order) query += ` ORDER BY "${order}"`;

    if (order && desc) query += ` DESC`;

    const customers = await db.query(query);
    return res.send(customers.rows);
  } catch (err) {
    console.log(err.message);
    return res.status(500).send(err.message);
  }
}

export async function getCustomerById(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT id, name, phone, cpf, TO_CHAR(birthday, 'YYYY-MM-DD') AS birthday from customers
       WHERE id = $1;`,
      [id]
    );

    if (result.rowCount === 0) res.sendStatus(404);

    return res.send(result.rows[0]);
  } catch (err) {
    console.log(err.message);
    return res.status(500).send(err.message);
  }
}

export async function editCustomerById(req, res) {
  const { id } = req.params;
  const { name, phone, cpf, birthday } = req.body;

  try {
    const result = await db.query(
      `
        SELECT * from customers 
        WHERE id != $1 
        AND cpf = $2;`,
      [id, cpf]
    );
    if (result.rowCount > 0)
      return res
        .status(409)
        .send({ message: "Outro cliente com o mesmo CPF já está cadastrado!" });

    await db.query(
      `UPDATE customers
        SET name = $2, phone = $3, cpf = $4, birthday = $5
        WHERE id = $1;`,
      [id, name, phone, cpf, birthday]
    );

    return res.sendStatus(200);
  } catch (err) {
    console.log(err.message);
    return res.status(500).send(err.message);
  }
}
