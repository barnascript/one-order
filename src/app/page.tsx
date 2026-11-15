import { OrderPage } from "@/components/OrderPage";
import { Dock, Footer, Header } from "@/components/Shell";

export default function Home() {
  return (
    <>
      <Header />
      <OrderPage />
      <Footer />
      <Dock />
    </>
  );
}
