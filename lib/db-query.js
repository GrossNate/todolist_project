const { Client } = require("pg");

const logQuery = (statement, parameters) => {
  const formattedTimeStamp = (new Date()).toString().substring(4, 24);
  console.log(formattedTimeStamp, statement, parameters);
};

module.exports = {
  async dbQuery(statement, ...parameters) {
    const client = new Client({ database: "todo-lists" });

    await client.connect();
    logQuery(statement, parameters);
    const result = await client.query(statement, parameters);
    await client.end();

    return result;
  }
}