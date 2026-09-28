require("dotenv").config();
const express = require("express");
const { connectDB } = require("./config/database"); //database connection
const cookieParser = require("cookie-parser");
const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const User = require("./models/user");
const userRouter = require("./routes/user");
const cors = require("cors");
const cronJob = require("./utils/cronjob");
const paymentRouter = require("./routes/payments");
const app = express(); //create server
const initializeSocket = require("./utils/socket");
const chatRouter = require("./routes/chat");
const { initRedis } = require("./config/redis");

const http = require("http");
app.use(
  cors({
    origin: [
      "https://devtinder.space",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", paymentRouter);
app.use("/", chatRouter);

const server = http.createServer(app);
initializeSocket(server);
connectDB()
  .then(async () => {
    await initRedis();
    console.log("Database connected successfully");
    server.listen(3000, () => {
      console.log("Server is running on port 3000");
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
  });
