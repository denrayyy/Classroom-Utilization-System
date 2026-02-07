import fetch from "node-fetch";
import https from "https";

const agent = new https.Agent({ family: 4 }); // force IPv4

fetch("https://worldtimeapi.org/api/timezone/Asia/Manila", { agent })
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
