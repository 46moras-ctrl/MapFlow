import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const caracteristicas = [
  {
    titulo: "Cobra",
    descripcion:
      "Envía recordatorios de pago y da seguimiento a tus cuentas por cobrar sin perseguir clientes.",
  },
  {
    titulo: "Controla",
    descripcion:
      "Visualiza tu flujo de caja en tiempo real y anticipa los meses difíciles antes de que lleguen.",
  },
  {
    titulo: "Crece",
    descripcion:
      "Toma decisiones con datos claros: márgenes, gastos y proyecciones al alcance de un clic.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">
            Map<span className="text-primary">Flow</span>
          </span>
          <nav className="flex items-center gap-3">
            <Button variant="ghost" size="sm">
              Iniciar sesión
            </Button>
            <Button size="sm">Crear cuenta</Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pb-24 pt-28 text-center">
          <Badge variant="secondary" className="mb-6">
            Copiloto financiero para PYMEs
          </Badge>
          <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-7xl">
            MapFlow
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-xl text-muted-foreground sm:text-2xl">
            Tu copiloto financiero: cobra, controla y crece.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button size="lg">Comenzar gratis</Button>
            <Button size="lg" variant="outline">
              Ver cómo funciona
            </Button>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-28">
          <div className="grid gap-6 sm:grid-cols-3">
            {caracteristicas.map((item) => (
              <Card key={item.titulo}>
                <CardHeader>
                  <CardTitle className="text-primary">{item.titulo}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {item.descripcion}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} MapFlow</span>
          <span>Hecho para dueños de PYMEs</span>
        </div>
      </footer>
    </div>
  );
}
