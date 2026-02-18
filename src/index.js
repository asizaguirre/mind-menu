const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Mind Menu service is running!");
});

const PORT = process.env.PORT || 3000;  // antes estava 4000
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
