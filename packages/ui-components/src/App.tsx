import { ModuleStatus } from "./components/ModuleStatus";
import "./index.css";

export function App() {
  return (
    <main className="storybook-shell">
      <ModuleStatus label="Package" value="ui-components" tone="ready" />
    </main>
  );
}
