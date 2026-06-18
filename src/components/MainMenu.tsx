interface MainMenuProps {
  onStart: () => void;
}

export function MainMenu({ onStart }: MainMenuProps): React.JSX.Element {
  return (
    <main className="menu-screen">
      <div className="cloud cloud--one" aria-hidden="true" />
      <div className="cloud cloud--two" aria-hidden="true" />
      <div className="menu-path" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <section className="menu-content">
        <div className="menu-mascot" aria-hidden="true">
          <span>•ᴗ•</span>
        </div>
        <h1 className="game-title">
          Stack<span>Breach</span>
        </h1>
        <p className="game-subtitle">
          트래픽을 나누고, 병목을 해결하고, 서비스를 지켜요.
        </p>

        <button type="button" className="soft-primary menu-start" onClick={onStart}>
          Stage 3 시작
        </button>
      </section>
    </main>
  );
}
