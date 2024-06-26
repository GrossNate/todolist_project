const config = require("./config");
const { Client } = require("pg");

const logQuery = (statement, parameters) => {
  const formattedTimeStamp = (new Date()).toString().substring(4, 24);
  console.log(formattedTimeStamp, statement, parameters);
};

const isProduction = (config.NODE_ENV === "production");
const CONNECTION = {
  connectionString: config.DATABASE_URL,
  ssl: isProduction ? {rejectUnauthorized: false } : false,
};

module.exports = {
  async dbQuery(statement, ...parameters) {
    const client = new Client(CONNECTION);

    await client.connect();
    logQuery(statement, parameters);
    const result = await client.query(statement, parameters);
    await client.end();

    return result;
  }
}