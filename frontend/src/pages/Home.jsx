// Page d'accueil : vitrine factice de la boutique "UrbanThread", qui sert de décor
// pour démontrer le widget de chat. Contient aussi le lien vers l'espace admin.
import { Link } from "react-router-dom";

// Produits de démonstration (données statiques).
const PRODUCTS = [
  { id: 1, name: "Chemise Oversize", price: "59€" },
  { id: 2, name: "Pantalon Cargo", price: "79€" },
  { id: 3, name: "Veste Denim", price: "99€" },
  { id: 4, name: "T-shirt Basique", price: "29€" },
].map((product) => ({
  ...product,
  // Image provisoire générée par placehold.co.
  image: `https://placehold.co/600x600/f5f5f5/171717?text=${encodeURIComponent(product.name)}&font=roboto`,
}));

function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <span className="text-lg font-bold tracking-tight">UrbanThread</span>
        <div className="flex gap-6 text-sm font-medium text-gray-700">
          <a href="#accueil" className="hover:text-black">
            Accueil
          </a>
          <a href="#produits" className="hover:text-black">
            Produits
          </a>
          <a href="#contact" className="hover:text-black">
            Contact
          </a>
        </div>
      </nav>

      <section id="accueil" className="flex flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Le streetwear, réinventé.
        </h1>
        <p className="max-w-xl text-gray-600">
          Des pièces intemporelles pensées pour durer, livrées partout en France en 48h.
        </p>
      </section>

      <section id="produits" className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-8 text-2xl font-semibold">Nos produits</h2>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {PRODUCTS.map((product) => (
            <div key={product.id} className="flex flex-col gap-2">
              <img
                src={product.image}
                alt={product.name}
                className="aspect-square w-full rounded-lg bg-gray-100 object-cover"
              />
              <p className="text-sm font-medium">{product.name}</p>
              <p className="text-sm text-gray-500">{product.price}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="contact" className="border-t border-gray-200 px-6 py-10 text-center text-sm text-gray-500">
        <p>© 2026 UrbanThread. Tous droits réservés.</p>
        <p className="mt-1">contact@urbanthread.fr</p>
        <Link to="/admin" className="mt-3 inline-block text-xs text-gray-400 hover:text-gray-600">
          Espace administration
        </Link>
      </footer>
    </div>
  );
}

export default Home;
