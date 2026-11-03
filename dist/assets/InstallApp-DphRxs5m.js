import{r as o,d as r,j as e}from"./react-vendor--CgM7R3s.js";import"./commonjs-Cpj98o6Y.js";const m="/images/drhamzaavatar.png",d="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png",c="/images/play-store.png",p="/images/app-store.png",h=()=>{const[t,l]=o.useState(null),s=r();o.useEffect(()=>{window.addEventListener("appinstalled",()=>{s("/")});const a=n=>{n.preventDefault(),l(n)};return window.addEventListener("beforeinstallprompt",a),()=>{window.removeEventListener("beforeinstallprompt",a)}},[s]);const i=()=>{t?(t.prompt(),t.userChoice.then(a=>{a.outcome==="accepted"&&s("/"),l(null)})):alert(`For iOS: Tap 'Share' → 'Add to Home Screen'.
For Desktop: Use the browser's install option.`)};return e.jsxs("div",{className:"relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500",children:[e.jsx("div",{className:"absolute w-80 h-80 bg-pink-400 rounded-full opacity-30 blur-3xl animate-blob top-10 left-10"}),e.jsx("div",{className:"absolute w-96 h-96 bg-teal-400 rounded-full opacity-20 blur-3xl animate-blob animation-delay-2000 top-64 right-0"}),e.jsx("div",{className:"absolute w-72 h-72 bg-yellow-400 rounded-full opacity-25 blur-3xl animate-blob animation-delay-4000 bottom-20 left-24"}),e.jsxs("div",{className:"relative z-10 flex flex-col lg:flex-row items-center justify-between w-full max-w-7xl p-8 gap-14",children:[e.jsxs("div",{className:"flex flex-col items-start text-left space-y-6",children:[e.jsx("img",{src:d,alt:"Medmacs Logo",className:"w-32 md:w-44 mb-4 drop-shadow-2xl"}),e.jsx("h1",{className:"text-5xl md:text-6xl font-extrabold text-white leading-tight drop-shadow-lg",children:e.jsx("span",{className:"bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-text-shimmer",children:"Install Medmacs"})}),e.jsx("p",{className:"text-white/90 text-lg md:text-xl max-w-lg leading-relaxed drop-shadow-sm",children:"Experience Pakistan’s most advanced AI-powered Medical prep platform as a lightweight, zero-KB application. Install on your device for quick access and offline-friendly performance."}),e.jsx("button",{onClick:i,className:"bg-gradient-to-r from-teal-400 to-cyan-500 text-white font-semibold px-10 py-4 rounded-2xl shadow-xl hover:scale-105 hover:shadow-cyan-400/50 transition-transform duration-300",children:"🚀 Install Application"}),e.jsxs("div",{className:"flex items-center gap-6 mt-4",children:[e.jsxs("div",{className:"flex items-center gap-2 bg-white/20 px-5 py-3 rounded-xl backdrop-blur-md hover:bg-white/30 transition shadow-lg",children:[e.jsx("img",{src:c,alt:"Play Store",className:"w-8 h-8"}),e.jsx("span",{className:"text-white font-medium",children:"Coming Soon"})]}),e.jsxs("div",{className:"flex items-center gap-2 bg-white/20 px-5 py-3 rounded-xl backdrop-blur-md hover:bg-white/30 transition shadow-lg",children:[e.jsx("img",{src:p,alt:"App Store",className:"w-8 h-8"}),e.jsx("span",{className:"text-white font-medium",children:"Coming Soon"})]})]})]}),e.jsx("div",{className:"flex-shrink-0 relative",children:e.jsx("img",{src:m,alt:"Dr Hamza Avatar",className:"h-[500px] md:h-[600px] object-contain rounded-3xl shadow-3xl animate-float"})})]}),e.jsx("style",{children:`
          @keyframes blob {
            0%, 100% { transform: translate(0,0) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }
          .animate-blob {
            animation: blob 18s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          .animation-delay-4000 {
            animation-delay: 4s;
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
          }
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
          @keyframes text-shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          .animate-text-shimmer {
            background-size: 200% auto;
            animation: text-shimmer 6s linear infinite;
          }
        `})]})};export{h as default};
