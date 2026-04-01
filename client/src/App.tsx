import { useState, useEffect } from "react";
import "./App.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement);

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token"));

  const [text, setText] = useState("");
  const [keystrokes, setKeystrokes] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [pasted, setPasted] = useState(false);

  function handleKeyDown(e: any) {
    setKeystrokes(prev => [...prev, { key: e.key, time: Date.now() }]);
  }

  function handlePaste() {
    setPasted(true);
  }

  function calculateAnalysis() {
    if (keystrokes.length < 2) return null;

    const totalTime =
      (keystrokes[keystrokes.length - 1].time -
        keystrokes[0].time) / 60000;

    if (!totalTime) return null;

    const wpm = Math.round((keystrokes.length / 5) / totalTime);

    let pauses = 0;

    for (let i = 1; i < keystrokes.length; i++) {
      const diff = keystrokes[i].time - keystrokes[i - 1].time;
      if (diff > 2000) pauses++;
    }

    const backspaces = keystrokes.filter(
      (k) => k.key === "Backspace"
    ).length;

    let score = 100;

    if (backspaces === 0) score -= 1;
    if (pauses === 0) score -= 1;
    if (pasted) score -= 60;

    if (score < 0) score = 0;

    return { wpm, pauses, backspaces, pasted, score };
  }

  async function register() {
    setError("");

    const res = await fetch("http://localhost:5000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await res.json();

    if (!res.ok) return setError(data.message);

    alert("Registered successfully!");
    setIsLogin(true);
  }

  async function login() {
    setError("");

    const res = await fetch("http://localhost:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) return setError(data.message);

    localStorage.setItem("token", data.token);
    setToken(data.token);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setNotes([]);
    setAnalysis(null);
  }

  async function saveNote() {
    if (!text.trim()) return setError("Write something first!");

    const result = calculateAnalysis();

    if (!result) {
      return setError("Not enough data to analyze");
    }

    setAnalysis(result);

    await fetch("http://localhost:5000/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, 
      },
      body: JSON.stringify({
        content: text,
        keystrokes,
        analysis: result,
      }),
    });

    setText("");
    setKeystrokes([]);
    setPasted(false);

    fetchNotes();
  }

  async function fetchNotes() {
    const res = await fetch("http://localhost:5000/notes", {
      headers: {
        Authorization: `Bearer ${token}`, 
      },
    });

    const data = await res.json();

    console.log("NOTES:", data); 

    setNotes(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (token) fetchNotes();
  }, [token]);

  const sortedNotes = [...notes].reverse();

  const chartData = {
    labels: sortedNotes.map((_, i) => `Session ${i + 1}`),
    datasets: [
      {
        label: "Score",
        data: sortedNotes.map(n => n.analysis?.score || 0),
      },
    ],
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="card">
          <h2>{isLogin ? "Login" : "Register"}</h2>

          {error && <p className="error">{error}</p>}

          {!isLogin && (
            <input
              placeholder="Username"
              onChange={e => setUsername(e.target.value)}
            />
          )}

          <input
            placeholder="Email"
            onChange={e => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            onChange={e => setPassword(e.target.value)}
          />

          <button onClick={isLogin ? login : register}>
            {isLogin ? "Login" : "Register"}
          </button>

          <p className="switch" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Create account" : "Already have account?"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="navbar">
        <h2>Vi-Notes</h2>
        <button onClick={logout}>Logout</button>
      </nav>

      <div className="dashboard">
        <div className="left-panel">
          <div className="card">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Start writing..."
            />
            <button onClick={saveNote}>Analyze & Save</button>
          </div>

          {analysis && (
            <div className="card">
              <h3>Analysis</h3>
              <p>WPM: {analysis.wpm}</p>
              <p>Pauses: {analysis.pauses}</p>
              <p>Backspaces: {analysis.backspaces}</p>
              <p>Score: {analysis.score}%</p>
            </div>
          )}

          <div className="card">
            <h3>History</h3>
            {notes.map((n, i) => (
              <div key={i} className="note">
                <p>Text: {n.content}</p>
                <span>Score: {n.analysis?.score}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="right-panel">
          <div className="card graph-card">
            <h3>Performance Graph</h3>
            {notes.length > 0 ? (
              <Line data={chartData} />
            ) : (
              <p>No data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;