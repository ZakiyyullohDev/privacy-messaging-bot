require('dotenv').config();
const pg = require('pg');

const pool = new pg.Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
});

async function uniqRow(query, ...arr) {
    try {
        const client = await pool.connect();
        const data = await client.query(query, arr);
        client.release();
        return data;
    } catch (error) {
        console.log(error, query, 'POSTGRESQL UNIQROW');
    }
};

module.exports = uniqRow;
