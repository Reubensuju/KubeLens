<div align="center">
  <br>
  <img src="resources/kubelens-icon.svg" width="64" height="64" alt="KubeLens Logo" />
  <h1>KubeLens</h1>
  <p><b>An explainable runtime debugger for Kubernetes straight inside VS Code.</b></p>
  <p>Understand <u>why</u> your pods are failing, don't just stare at them.</p>
</div>

---

## 👁️ Overview

When a deployment fails, jumping back and forth between a clunky CLI and complex dashboards to figure out what happened breaks your flow. **KubeLens** solves this by acting as a native "senior engineer" residing in your IDE. 

It connects directly to your existing `~/.kube/config`, parses your contexts recursively down to the exact failing Pod, and provides a rich HTML explanation of precisely *why* it's crashing and *how* to fix it.

> *KubeLens was deliberately designed exclusively for Kubernetes observability—fast, lightweight, and living comfortably in your editor's sidebar.*

## ✨ Features

- **Context-Aware Tree Navigation**: Native Explorer panels dissecting your clusters into Namespaces and Pods cleanly. Switch Contexts seamlessly.
- **Rule-Based Insight Engine**: Run `"Explain Pod"` to instantly analyze crash loops, detect missing environment variables, catch port conflicts, and diagnose `ECONNREFUSED` dependency panics.
- **One-Click Native Logs**: Spawn a VS Code integrated terminal actively tailing `kubectl logs -f` specifically targeted at your workload. 
- **Direct Shell Injection**: Spin up an interactive `sh` or `bash` execution right inside your running Pod with a single inline button click.
- **Dark-Mode Friendly Branding**: Aesthetic and dynamic icons that respect your custom theme configuration natively.

## 🚀 Getting Started

Because KubeLens runs locally natively against your machine's `kubectl` CLI authentication bindings, there is ZERO external configuration required. If `kubectl` works in your terminal, KubeLens works.

1. Ensure the extension is running (hit `F5` in the Extension Host if actively debugging).
2. Open the **KubeLens** activity bar (the shutter logo on your left).
3. Expand **Clusters**, select your desired Namespace, and drill down into the Pods list.
4. Click the magnifying glass **"Explain"** icon on any Pod to launch the Insights Panel.

## 🧠 Diagnostic Engine (Under the Hood)

The extension relies on entirely local analysis, making it incredibly fast.
1. Fetching raw Pod logs using the `@kubernetes/client-node` TypeScript bindings.
2. Slicing structural metadata (i.e., `RestartCount` > 3, Phase patterns).
3. Piping data into custom heuristics capable of surfacing the exact fix you need with a defined level of confidence.

## 🛠️ Architecture & Contributing

KubeLens is powered structurally using the VS Code Extension API.
- **`src/ui/KubeLensTreeDataProvider.ts`**: Translates Kubernetes metadata dynamically into standard `BaseTreeItem` nodes.
- **`src/kubernetes/kubernetesClient.ts`**: An encapsulated ESM-safe interface querying your local configuration efficiently.
- **`src/analysis/engine.ts`**: The core diagnostic mapper predicting and framing solutions.

---

<div align="center">
  <sub>Built tightly explicitly for scale and speed inside VS Code.</sub>
</div>