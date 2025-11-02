const express = require('express');
const dotenv = require('dotenv');
dotenv.config()

require('./bot.js')

const app = express()
app.use(express.json())

const PORT = process.env.PORT

app.listen(PORT, () => {
    console.info('=================================');
    console.info(`======== ENV: production ========`);
    console.info(`🚀 App listening on the port ${PORT}`);
    console.info('=================================');
})
