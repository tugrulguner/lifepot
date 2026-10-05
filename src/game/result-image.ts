import type { SimulationState } from "./world";
import { speciesColor } from "./species-colors";

export const RESULT_IMAGE_WIDTH = 1600;
export const RESULT_IMAGE_HEIGHT = 1000;
export const RESULT_IMAGE_URL = "https://lifepot.modepot.io";
export type ResultImageCell = { guild: number; species: string; role: string; resource: number };
export type ResultImageEvidence = { births: number; deaths: number; kills: number; history?: Array<{ generation: number; population: number }> };
export type ResultImageModel = {
  width: number; height: number; boardSize: number; cells: ResultImageCell[];
  generation: number; outcome: SimulationState["outcome"]; stopReason: string;
  question: string; speciesCounts: Array<{ species: string; count: number }>;
  totalPopulation: number; prey: number; predators: number; totalResources: number;
  totalBirths: number; totalDeaths: number; totalKills: number;
  environment: string; history: Array<{ generation: number; population: number }>;
};

export function buildResultImageModel(state: SimulationState, question: string, stopReason: string, evidence?: ResultImageEvidence): ResultImageModel {
  const counts = new Map<string, number>();
  const cells = Array.from({ length: state.guild.length }, (_, index) => {
    const guild = state.guild[index] ?? 0;
    const slot = guild ? state.ruleSpecies[index] ?? 0 : 0;
    const configured = slot ? state.config.rules?.species[slot - 1] : undefined;
    const species = configured?.id ?? "";
    if (guild && configured) counts.set(species, (counts.get(species) ?? 0) + 1);
    return { guild, species, role: configured?.role ?? "", resource: state.resources[index] ?? 0 };
  });
  let prey = 0, predators = 0, totalResources = 0;
  for (const cell of cells) { if (cell.guild === 1) prey++; else if (cell.guild === 2) predators++; totalResources += cell.resource; }
  return {
    width: RESULT_IMAGE_WIDTH, height: RESULT_IMAGE_HEIGHT,
    boardSize: Math.sqrt(state.guild.length), cells, generation: state.generation,
    outcome: state.outcome, stopReason, question,
    speciesCounts: (state.config.rules?.species ?? []).map(item => ({ species: item.id, count: counts.get(item.id) ?? 0 })),
    totalPopulation: prey + predators, prey, predators, totalResources,
    totalBirths: evidence?.births ?? state.stats.births, totalDeaths: evidence?.deaths ?? state.stats.deaths, totalKills: evidence?.kills ?? state.stats.kills,
    environment: `${state.config.environment.abundance} resources · ${state.config.environment.distribution} · ${state.config.environment.hazard} · ${state.config.environment.volatility}`,
    history: evidence?.history ?? state.history.map(frame => ({ generation: frame.generation, population: frame.prey + frame.predators })),
  };
}

function wrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let line = "";
  for (const original of words) {
    let word = original;
    while (word && ctx.measureText(word).width > maxWidth) { const chunk = word.slice(0, Math.max(1, Math.floor(word.length * maxWidth / ctx.measureText(word).width))); lines.push(chunk); word = word.slice(chunk.length); }
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; let last = lines[maxLines - 1]; while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1); lines[maxLines - 1] = `${last}…`; }
  return lines;
}

export function drawResultImage(ctx: CanvasRenderingContext2D, model: ResultImageModel): void {
  const { width, height } = model;
  ctx.fillStyle = "#07111f"; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#e8f1fa"; ctx.font = "700 48px system-ui, sans-serif"; ctx.fillText("LifePot · World result", 72, 78);
  ctx.fillStyle = "#a9bfd3"; ctx.font = "24px system-ui, sans-serif";
  ctx.fillText(`Generation ${model.generation} · ${model.totalPopulation === 0 ? "WORLD EMPTY" : "OBSERVATION COMPLETE"}`, 72, 122);
  const bx = 72, by = 160, board = 720, cellSize = board / model.boardSize;
  ctx.fillStyle = "#102237"; ctx.fillRect(bx, by, board, board);
  for (let i = 0; i < model.cells.length; i++) {
    const cell = model.cells[i], x = bx + (i % model.boardSize) * cellSize, y = by + Math.floor(i / model.boardSize) * cellSize;
    if (cell.resource) { ctx.fillStyle = `rgba(55, 190, 133, ${Math.min(.65, .08 + cell.resource / 400)})`; ctx.fillRect(x, y, cellSize, cellSize); }
    if (cell.guild) {
      ctx.fillStyle = cell.species ? speciesColor(cell.species as import("./rules").SpeciesId) : (cell.guild === 1 ? "#65d6a0" : "#ff8b72");
      const inset = cellSize * .18; ctx.beginPath();
      if (cell.role === "hunter") { ctx.moveTo(x + cellSize / 2, y + inset); ctx.lineTo(x + cellSize - inset, y + cellSize - inset); ctx.lineTo(x + inset, y + cellSize - inset); ctx.closePath(); }
      else if (cell.role === "omnivore") ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);
      else ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * .32, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tx = 940, tw = 590; ctx.fillStyle = "#f2f6fb"; ctx.font = "700 30px system-ui, sans-serif"; ctx.fillText("Final ecosystem", tx, 190);
  ctx.font = "23px system-ui, sans-serif"; ctx.fillStyle = "#d0dfec";
  const stats = [`Population  ${model.totalPopulation}`, `Other roles ${model.prey} · Hunters/omnivores ${model.predators}`, `Births ${model.totalBirths} · Deaths ${model.totalDeaths} · Kills ${model.totalKills}`, `Mean resources/cell  ${(model.totalResources / model.cells.length).toFixed(1)}`];
  stats.slice(0, 4).forEach((line, i) => ctx.fillText(line, tx, 238 + i * 38));
  wrappedLines(ctx, model.environment, tw, 2).forEach((line, i) => ctx.fillText(line, tx, 398 + i * 28));
  model.speciesCounts.forEach((item, i) => ctx.fillText(`Species ${item.species} · ${item.count}`, tx, 466 + i * 30));
  if (model.history.length > 1) { const gx = tx, gy = 610, gw = 540, gh = 100, max = Math.max(1, ...model.history.map(p => p.population)); ctx.strokeStyle = "#79dfaf"; ctx.lineWidth = 4; ctx.beginPath(); model.history.forEach((p, i) => { const x = gx + i / (model.history.length - 1) * gw, y = gy + gh - p.population / max * gh; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); ctx.fillStyle = "#a9bfd3"; ctx.font = "18px system-ui, sans-serif"; ctx.fillText(`Population · generations ${model.history[0].generation}–${model.history.at(-1)!.generation}`, gx, gy - 12); }
  ctx.fillStyle = "#a9bfd3"; ctx.font = "700 20px system-ui, sans-serif"; ctx.fillText("STOP REASON", tx, 750);
  ctx.fillStyle = "#f2f6fb"; ctx.font = "22px system-ui, sans-serif";
  wrappedLines(ctx, model.stopReason, tw, 2).forEach((line, i) => ctx.fillText(line, tx, 780 + i * 26));
  if (model.question) { ctx.fillStyle = "#a9bfd3"; ctx.font = "700 18px system-ui, sans-serif"; ctx.fillText("QUESTION", tx, 835); ctx.fillStyle = "#f2f6fb"; ctx.font = "20px system-ui, sans-serif"; wrappedLines(ctx, model.question, tw, 2).forEach((line, i) => ctx.fillText(line, tx, 866 + i * 27)); }
  ctx.fillStyle = "#79dfaf"; ctx.font = "700 22px system-ui, sans-serif"; ctx.fillText(RESULT_IMAGE_URL, 72, 950);
}


export async function createResultImageBlob(model: ResultImageModel): Promise<Blob> {
  const canvas = document.createElement("canvas"); canvas.width = model.width; canvas.height = model.height;
  const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is unavailable");
  drawResultImage(context, model);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG creation failed")), "image/png"));
}
