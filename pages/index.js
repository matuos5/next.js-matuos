export default function Home() {
  return (
    <div style={{
      backgroundImage: "url('https://files.catbox.moe/824t2k.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      textShadow: "2px 2px 5px rgba(0,0,0,0.7)",
      fontFamily: "Arial, sans-serif",
      flexDirection: "column"
    }}>
      <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
        مرحبًا بك في عالم <span style={{ color: "#7c6eff" }}>ساسكي بوت</span>
      </h1>
      <p style={{ fontSize: "1.2rem" }}>⚡ تجربة الذكاء الاصطناعي بنكهة الشارينغان ⚡</p>
    </div>
  );
}
