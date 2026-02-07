const express = require("express");
const cors = require("cors");

const apiRoutes = require("./routes/api");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", apiRoutes);

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
});
