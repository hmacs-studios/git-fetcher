const AppTransitionScreen = () => {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden bg-background text-foreground transition-colors duration-300">
      <div className="relative flex items-center justify-center w-[140px] h-[140px] bg-card rounded-full shadow-lg border border-border animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
        <img
          src="/icon.svg"
          alt="Medmacs"
          className="h-[100px] w-[100px] object-contain"
        />
      </div>
    </div>
  );
};

export default AppTransitionScreen;
