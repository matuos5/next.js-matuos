import Image from 'next/image'

export default function Home() {
  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <img
          src="https://files.catbox.moe/5tckv3.mp4"
          alt="Sasuke"
          style={styles.gif}
        />

        <h1 style={styles.title}>
          مرحبًا بك في عالم <span style={{ color: '#4ade80' }}>ساسكي بوت</span><br />
          حيث تبدأ رحلتك مع القوة ⚡
        </h1>

        <a href="https://whatsapp.com/channel/0029VaklBGFHFxOwODjsoP13" target="_blank">
          <button style={styles.button}>انضم إلى قناتنا</button>
        </a>
      </div>
    </main>
  )
}

const styles = {
  main: {
    minHeight: '100vh',
    backgroundColor: '#0f0f0f',
    color: 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: '"Cairo", sans-serif',
    padding: '20px',
  },
  container: {
    textAlign: 'center',
    maxWidth: '600px',
  },
  gif: {
    width: '100%',
    maxWidth: '400px',
    borderRadius: '20px',
    marginBottom: '30px',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: '700',
    marginBottom: '20px',
    lineHeight: '1.5',
  },
  button: {
    backgroundColor: '#22c55e',
    color: 'white',
    fontSize: '1.2rem',
    fontWeight: '600',
    border: 'none',
    borderRadius: '12px',
    padding: '15px 30px',
    cursor: 'pointer',
    transition: 'all 0.3s',
  },
}
