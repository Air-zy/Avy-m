const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// configs
const PRODUCTION_PUBLIC_DIRECTORY = path.join(__dirname, './public')
app.use(require('./reqLogger.js'));
app.use(express.json());
app.use(express.static(PRODUCTION_PUBLIC_DIRECTORY));

// routes 
app.get('/home',   (req, res) => { return res.redirect('/index.html');  });
app.get('/trafic', (req, res) => { return res.redirect('/trafic.html'); });
app.get('/info', require('./routes/info.js'));

app.get('/api/logs', require('./routes/api_logs.js') );
app.post('/nfetch',  require('./routes/nfetch.js')   );

app.listen(PORT, () => {
  console.log(`avy server running on port ${PORT}`);
});

console.log("node version:",process.version);

const { startCycler } = require('./heartSystem/heart.js');
startCycler();

const { loginAvy } = require('./discordBot/avyMain.js');
loginAvy();