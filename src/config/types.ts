export interface InstallationConfig {
  readonly schemaVersion: 1;
  readonly configVersion: number;
  readonly project: {
    readonly id: string;
    readonly name: string;
    readonly prefix: string;
    readonly baseUrl: string;
  };
  readonly locale: "es";
  readonly members: readonly {
    readonly id: string;
    readonly name: string;
    readonly defaultView: "work" | "feedback";
  }[];
  readonly areas: readonly { readonly id: string; readonly label: string }[];
  readonly defaultAreaId: string;
  readonly statusLabels: Readonly<Record<"todo" | "in_progress" | "in_review" | "done", string>>;
  readonly typeLabels: Readonly<Record<"task" | "feedback", string>>;
  readonly policy: { readonly agentsCanComplete: boolean };
  readonly brand: {
    readonly name: string;
    readonly accentLight: string;
    readonly accentDark: string;
  };
}
