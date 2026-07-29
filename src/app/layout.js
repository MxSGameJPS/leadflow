import "./globals.css";

export const metadata = {
  title: "LeadFlow — Pipeline de Fechamento",
  description: "Gestao de leads local",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
