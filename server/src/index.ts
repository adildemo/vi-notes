import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const PORT = 5000;
const JWT_SECRET = "supersecretkey";

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/vinotes")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));


const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
});

const dataSchema = new mongoose.Schema({
  userId: String,
  content: String,
  keystrokes: Array,
  analysis: Object,
  createdAt: { type: Date, default: Date.now },
});


const User = mongoose.model("User", userSchema);
const Data = mongoose.model("Data", dataSchema, "data");


function auth(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}


app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = new User({ username, email, password: hashed });
  await user.save();

  res.json({ message: "Registered" });
});


app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user: any = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Wrong password" });

  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });

  res.json({ token });
});


app.post("/save", auth, async (req: any, res) => {
  const { content, keystrokes, analysis } = req.body;

  const data = new Data({
    userId: req.user.id,
    content,
    keystrokes,
    analysis,
  });

  await data.save();

  res.json({ message: "Saved" });
});


app.get("/notes", auth, async (req: any, res) => {
  const data = await Data.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(data);
});


app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});