import type { Metadata } from "next";
import { Dock, Footer, Header } from "@/components/Shell";

export const metadata: Metadata = { title: "One Order: accessibility" };

const POINTS: { t: string; d: string }[] = [
  {
    t: "Screen readers",
    d: "I use real headings, landmarks, buttons and form labels. Every step heading says which step it is and whether it has started. The step bar says which steps are done, which one is happening now and which have not started.",
  },
  {
    t: "Every update, read out and shown",
    d: "When something happens on the order (a new quote, the truck crossing the border, a signature, the payment), I show it on screen in the updates box and screen readers read it out. Nothing in the app depends on sound.",
  },
  {
    t: "No sound needed",
    d: "The app makes no sound at all. Every alert, warning and confirmation is text you can see, so deaf and hard-of-hearing people get exactly the same information.",
  },
  {
    t: "Keyboard only",
    d: "You can do everything with the keyboard. A skip link jumps past the header, focus is always visible, and the step links move focus to that step's heading.",
  },
  {
    t: "Signing without drawing",
    d: "Not everyone can draw a signature on a screen. The driver app lets the receiver type their full name instead, and the record shows it as a typed signature.",
  },
  {
    t: "The map in words",
    d: "The tracking map has a text description, and I list the same trip in words next to it: distance driven, where the truck is, the arrival time and each milestone. The progress bar reports the kilometres to screen readers.",
  },
  {
    t: "Colour and contrast",
    d: "All text meets WCAG AA contrast (4.5:1 or more). On the cream sections I use deeper orange, green and red than on the dark ones, so the colours still pass. Colour never carries meaning alone: every status also has words.",
  },
  {
    t: "Motion and display settings",
    d: "If your device asks for reduced motion, I turn off the animations. The layout works when zoomed to 200%, down to phone width, and in Windows high-contrast mode.",
  },
];

export default function AccessibilityPage() {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>
        <section className="hero">
          <div className="slate w" aria-hidden="true">
            Sc. 10 / Int. for everyone / always
          </div>
          <h1 className="d">
            <span className="l1">Built for everyone.</span>
            <span className="l2" style={{ fontSize: "clamp(64px, 11vw, 170px)" }}>
              Accessibility
            </span>
          </h1>
          <p className="lede">
            Freight runs on people with every kind of ability: planners, drivers, finance teams. I built One Order so that blind, low-vision, deaf,
            hard-of-hearing and keyboard-only users can run the whole order, from the request to the payment. I aim for WCAG 2.2 level AA.
          </p>
        </section>
        <section className="scene" aria-labelledby="how-h">
          <h2 className="sr" id="how-h">
            How I made it accessible
          </h2>
          <ul className="a11y-list">
            {POINTS.map((p) => (
              <li key={p.t}>
                <b>{p.t}</b>
                {p.d}
              </li>
            ))}
          </ul>
          <p className="note" style={{ marginTop: 20 }}>
            I check it with axe and by running the whole order with the keyboard only. If something does not work for you, please tell me at
            barnascript@gmail.com.
          </p>
        </section>
      </main>
      <Footer />
      <Dock />
    </>
  );
}
