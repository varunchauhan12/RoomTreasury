import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useReducedMotion } from "motion/react";
import { ExpandableScreen, ExpandableScreenContent, ExpandableScreenTrigger, useExpandableScreen } from "./expandable-screen";
import { HaloButton } from "./halo-button";
import Textarea from "./textarea";

type CreatedProject = { binding: { client_project_id: string } };
type ProjectIntakeProps = {
  initiallyOpen: boolean;
  demo: boolean;
  submit: (fields: Record<string, FormDataEntryValue>) => Promise<CreatedProject | null>;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  onBack?: () => void;
};

function IntakeForm({ demo, submit, created }: Pick<ProjectIntakeProps, "demo" | "submit"> & { created: (id: string) => void }) {
  const { collapse } = useExpandableScreen();
  const form = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const [status, setStatus] = useState<"ready" | "saving" | "saved">("ready");
  const [error, setError] = useState("");

  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>("input[name=projectName]")?.focus({ preventScroll: true });
  }, []);

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !busy.current) {
      event.preventDefault();
      collapse();
    }
    if (event.key !== "Tab") return;
    const controls = [...(form.current?.querySelectorAll<HTMLElement>("input, textarea, button") ?? [])]
      .filter(control => !control.matches(":disabled"));
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    busy.current = true;
    setStatus("saving");
    setError("");
    try {
      const result = await submit(fields);
      if (!result) throw Error("Project creation is already in progress.");
      setStatus("saved");
      created(result.binding.client_project_id);
      collapse();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not create the project.");
      busy.current = false;
      setStatus("ready");
    }
  }

  return (
    <div className="rt-intake-screen" role="dialog" aria-modal="true" aria-labelledby="rt-intake-heading" onKeyDown={handleKeys}>
      <button type="button" className="rt-intake-close" disabled={status !== "ready"} onClick={collapse} aria-label="Close and go to All Projects" title="Close — All Projects">×</button>
      <header>
        <button type="button" className="rt-intake-back" onClick={collapse} aria-label="Back to All Projects">← Back to All Projects</button>
        <p className="rt-section-kicker">Project intake</p>
        <h1 id="rt-intake-heading">Let's start a project.</h1>
        <p>Tell us about your client and the work you want to deliver.</p>
      </header>
      <form id="rt-expanded-intake" ref={form} onSubmit={save} aria-busy={status === "saving"} onInput={() => setError("")}>
        <fieldset disabled={status !== "ready"}>
          <legend>Project details</legend>
          <div className="rt-intake-grid">
            <label>Project name <input name="projectName" required maxLength={180} /></label>
            <label>Client name <input name="clientName" required maxLength={300} autoComplete="organization" /></label>
          </div>
        </fieldset>
        <fieldset disabled={status !== "ready"}>
          <legend>Project brief</legend>
          <label>Project description <Textarea name="description" rows={5} required maxLength={1000} placeholder="What are you building, and why?" /></label>
          <div className="rt-intake-grid">
            <label>Requirements and scope <Textarea name="requirements" rows={3} required maxLength={1000} /></label>
            <label>Deliverables <Textarea name="deliverables" rows={3} required maxLength={700} /></label>
          </div>
          <label>Additional notes <span>Optional</span><Textarea name="notes" rows={2} maxLength={700} /></label>
        </fieldset>
        <fieldset disabled={status !== "ready"}>
          <legend>Price and timeline</legend>
          <div className="rt-intake-grid">
            <label>Proposed client price (USD)
              <input name="price" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required placeholder="1000.00" />
            </label>
            <label>Desired deadline <span>Optional</span><input name="deadline" type="date" /></label>
          </div>
          <p>Client price is an intake estimate. Delivery budget is approved separately.</p>
        </fieldset>
        <div className="rt-intake-actions">
          <button className="rt-intake-cancel" type="button" disabled={status !== "ready"} onClick={collapse}>Cancel</button>
          <HaloButton type="submit" translucent={false} staggerLabel={false} isLoading={status === "saving"} disabled={status === "saved"} loadingText="Creating project…">Create Project</HaloButton>
        </div>
        {error && <p role="alert" className="rt-intake-error">{error}</p>}
        <p className="rt-intake-feedback" role="status">{status === "saved" ? "Project created." : status === "saving" ? "Saving your project…" : ""}</p>
        {demo && <p className="rt-intake-demo">Local demo. Actions use shared access and do not verify human identity.</p>}
      </form>
    </div>
  );
}

export function ProjectIntake({ initiallyOpen, demo, submit, onOpenChange, onCreated, onBack }: ProjectIntakeProps) {
  const reduced = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const createdId = useRef<string | null>(null);
  return (
    <div ref={host}>
      <ExpandableScreen defaultExpanded={initiallyOpen} layoutId="rt-project-intake" animationDuration={reduced ? 0 : 0.32} onExpandChange={open => { if (open) onOpenChange(true); }}>
        <ExpandableScreenTrigger>
          <button type="button" className="rt-intake-trigger" aria-haspopup="dialog">New Project</button>
        </ExpandableScreenTrigger>
        <ExpandableScreenContent className="rt-project-intake-surface" overlayClassName="rt-intake-overlay" showCloseButton={false} onExitComplete={() => {
          const id = createdId.current;
          createdId.current = null;
          onOpenChange(false);
          if (id) onCreated(id);
          else if (onBack) onBack();
          else host.current?.querySelector("button")?.focus();
        }}>
          <IntakeForm demo={demo} submit={submit} created={id => { createdId.current = id; }} />
        </ExpandableScreenContent>
      </ExpandableScreen>
    </div>
  );
}
