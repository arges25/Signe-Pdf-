import { ArrowRight, FileEdit, FileText, PenLine, ScanLine, ShieldCheck } from "lucide-react";

export default function Home({ onSign, onEdit, onScan, onCreate }: { onSign: () => void; onEdit: () => void; onScan: () => void; onCreate: () => void }) {
  return <div className="app-shell">
    <header className="site-header">
      <div className="brand" aria-label="Signé"><span className="brand-icon"><PenLine size={23} strokeWidth={1.9} /></span><span>Signé<span className="brand-period">.</span></span></div>
      <span className="header-divider" /> <span className="header-description">La signature, simplement.</span>
      <div className="local-badge"><ShieldCheck size={17} /><span>Tout reste sur votre appareil</span></div>
    </header>
    <main className="main-content home-main">
      <div className="home-intro">
        <p className="eyebrow">SIGNÉ</p>
        <h1>Que voulez-vous faire ?</h1>
        <p className="home-subtitle">Tout se passe sur votre appareil : aucun document n’est jamais envoyé en ligne.</p>
      </div>
      <div className="home-cards">
        <button type="button" className="home-card" onClick={onSign}>
          <span className="home-card-icon"><PenLine size={26} /></span>
          <h2>Signer un PDF</h2>
          <p>Ajoutez votre signature à un document et téléchargez-le signé.</p>
          <span className="home-card-cta">Commencer <ArrowRight size={16} /></span>
        </button>
        <button type="button" className="home-card" onClick={onEdit}>
          <span className="home-card-icon home-card-icon-alt"><FileEdit size={26} /></span>
          <h2>Modifier un PDF</h2>
          <p>Corrigez un texte, ajoutez une date, une coche ou un surlignage, puis signez si besoin.</p>
          <span className="home-card-cta">Commencer <ArrowRight size={16} /></span>
        </button>
        <button type="button" className="home-card" onClick={onScan}>
          <span className="home-card-icon home-card-icon-scan"><ScanLine size={26} /></span>
          <h2>Scanner / Image vers PDF</h2>
          <p>Photographiez ou importez un document, corrigez la perspective et créez un PDF.</p>
          <span className="home-card-cta">Commencer <ArrowRight size={16} /></span>
        </button>
        <button type="button" className="home-card" onClick={onCreate}>
          <span className="home-card-icon home-card-icon-create"><FileText size={26} /></span>
          <h2>Créer un document</h2>
          <p>Rédigez une lettre ou une attestation à partir d’un modèle, puis signez ou exportez.</p>
          <span className="home-card-cta">Commencer <ArrowRight size={16} /></span>
        </button>
      </div>
    </main>
    <footer className="page-footer home-footer"><span>Un document. Vos corrections. Votre signature.</span></footer>
  </div>;
}
