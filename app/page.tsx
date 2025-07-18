'use client';
import { useRef, useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [videoSrc, setVideoSrc] = useState('');

  // قائمة الفيديوهات المتاحة
  const videoList = [
    'https://files.catbox.moe/5tckv3.mp4', // الفيديو الأصلي
    'https://files.catbox.moe/rlqfsa.mp4',
    'https://files.catbox.moe/pkviy4.mp4',
    'https://files.catbox.moe/khkrho.mp4',
    'https://files.catbox.moe/14wrkb.mp4',
    'https://files.catbox.moe/bfy2ay.mp4',
  ];

  // اختيار فيديو عشوائي عند أول تحميل
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * videoList.length);
    setVideoSrc(videoList[randomIndex]);

    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.volume = 1;
    }
  }, []);

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setMuted(video.muted);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden font-[family-name:var(--font-geist-sans)]">
      {/* الفيديو يغطي كامل الشاشة */}
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
      >
        المتصفح لا يدعم تشغيل الفيديو.
      </video>

      {/* المحتوى فوق الفيديو */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center bg-black/50">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600">
          ⚡ مرحبًا بك في عالم ساسكي ⚡
        </h1>

        {/* أزرار واتساب */}
        <div className="flex flex-col gap-4">
          <a
            href="https://whatsapp.com/channel/0029VaklBGFHFxOwODjsoP13"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/90 text-black font-semibold py-3 px-8 rounded-full shadow-lg hover:bg-white transition-all duration-200"
          >
            الدخول إلى قناة واتساب
          </a>
          <a
            href="https://wa.me/201229466261"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-500 text-white font-semibold py-3 px-8 rounded-full shadow-lg hover:bg-green-600 transition-all duration-200"
          >
            التحدث معي على واتساب
          </a>
        </div>
      </div>

      {/* زر الصوت العائم */}
      <button
        onClick={toggleMute}
        className="fixed bottom-6 right-6 z-20 bg-black/70 text-white p-3 rounded-full shadow-lg hover:bg-black/90 transition-all"
        aria-label="تبديل الصوت"
      >
        {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
      </button>
    </div>
  );
}
