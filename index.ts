// import express, { Request, Response } from "express";
// import fs from "fs";

// const app = express();

// // this middleware helps parsing incoming requests with a JSON payload and makes the resulting object available on req.body
// app.use(express.json());

// const port = process.env.PORT || 3000;

// const text = JSON.parse(fs.readFileSync("./text.json").toString());

// app.get("/", (_req: Request, res: Response) => {
//   res.status(200).json({ message: "hello world", app: "test", data: text });
// });

// app.post("/", (req: Request, res: Response) => {
//   console.log(req.body);
//   res.send("Done");
// });

// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });
