export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        {/* إضافة الفيديو والعبارة */}
        <div className="flex flex-col items-center w-full">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600">
            ⚡ مرحبًا بك في عالم ساسكي ⚡
          </h1>
          <video
            className="w-full max-w-2xl rounded-xl shadow-lg"
            controls
            autoPlay
            loop
          >
            <source src="https://files.catbox.moe/5tckv3.mp4" type="video/mp4" />
            المتصفح لا يدعم تشغيل الفيديو.
          </video>

          {/* زر القناة على واتساب */}
          <a
            href="https://whatsapp.com/channel/0029VaklBGFHFxOwODjsoP13"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 bg-white text-black font-semibold py-2 px-6 rounded-full shadow hover:bg-gray-100 transition-colors"
          >
            الدخول إلى قناة واتساب
          </a>
        </div>
      </main>
    </div>
  );
}
