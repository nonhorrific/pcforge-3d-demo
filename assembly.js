(() => {
  const palettes = {
    case: "#293744", motherboard: "#18513f", cpu: "#9aa8b4", memory: "#243852",
    gpu: "#252c38", cooler: "#697887", storage: "#1b2935", psu: "#3a4148",
    monitor: "#202a35", keyboard: "#202a34", mouse: "#303b47", headset: "#242d38", webcam: "#2f3943"
  };
  const labels = {
    cpu: "Processor", gpu: "Graphics card", motherboard: "Motherboard", memory: "Memory",
    storage: "Storage", cooler: "CPU cooling", case: "Case", psu: "Power supply",
    monitor: "Monitor", keyboard: "Keyboard", mouse: "Mouse", headset: "Headset", webcam: "Webcam"
  };
  const boxFaces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const view = { canvas: null, ctx: null, selected: [], mode: "assembled", focus: "all", yaw: 0.72, pitch: 0.43, zoom: 1, panX: 0, panY: 0, dpr: 1, dragging: false, moved: false, lastX: 0, lastY: 0, faces: [], frame: 0 };
  const $ = (selector) => document.querySelector(selector);

  function colorShade(hex, amount) {
    const value = hex.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16), g = parseInt(value.slice(2, 4), 16), b = parseInt(value.slice(4, 6), 16);
    const scale = (channel) => Math.max(0, Math.min(255, Math.round(channel * amount)));
    return `rgb(${scale(r)} ${scale(g)} ${scale(b)})`;
  }

  function addFace(group, points, color, options = {}) {
    view.faces.push({ group, points, color, opacity: options.opacity ?? 1, stroke: options.stroke || null, strokeWidth: options.strokeWidth || 0.7 });
  }

  function addBox(group, center, size, color, options = {}) {
    const [x, y, z] = center, [w, d, h] = size;
    const vertices = [
      [x - w / 2, y - d / 2, z - h / 2], [x + w / 2, y - d / 2, z - h / 2],
      [x + w / 2, y + d / 2, z - h / 2], [x - w / 2, y + d / 2, z - h / 2],
      [x - w / 2, y - d / 2, z + h / 2], [x + w / 2, y - d / 2, z + h / 2],
      [x + w / 2, y + d / 2, z + h / 2], [x - w / 2, y + d / 2, z + h / 2]
    ];
    for (const face of boxFaces) addFace(group, face.map((index) => vertices[index]), color, options);
  }

  function addCylinder(group, axis, center, radius, depth, color, segments = 24) {
    const [x, y, z] = center;
    const rings = [];
    for (const side of [-1, 1]) {
      const ring = [];
      for (let i = 0; i < segments; i++) {
        const angle = (Math.PI * 2 * i) / segments;
        const a = Math.cos(angle) * radius, b = Math.sin(angle) * radius;
        ring.push(axis === "x" ? [x + side * depth / 2, y + a, z + b]
          : axis === "y" ? [x + a, y + side * depth / 2, z + b]
            : [x + a, y + b, z + side * depth / 2]);
      }
      rings.push(ring);
    }
    const [nearRing, farRing] = rings;
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      addFace(group, [nearRing[i], farRing[i], farRing[next], nearRing[next]], color);
    }
    addFace(group, nearRing, color);
    addFace(group, farRing, color);
  }

  function addDiscFan(group, axis, center, radius, color, bladeCount = 7) {
    addCylinder(group, axis, center, radius, 0.09, "#101820", 32);
    addCylinder(group, axis, center, radius * 0.88, 0.035, "#596775", 32);
    const [cx, cy, cz] = center;
    const plane = axis === "x" ? (u, v, offset = -0.07) => [cx + offset, cy + u, cz + v]
      : axis === "y" ? (u, v, offset = -0.07) => [cx + u, cy + offset, cz + v]
        : (u, v, offset = 0.07) => [cx + u, cy + v, cz + offset];
    for (let i = 0; i < bladeCount; i++) {
      const angle = i * Math.PI * 2 / bladeCount;
      const p = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
      const a = p(radius * 0.28, angle - 0.16), b = p(radius * 0.93, angle + 0.14);
      const c = p(radius * 0.79, angle + 0.62), d = p(radius * 0.30, angle + 0.48);
      addFace(group, [plane(...a), plane(...b), plane(...c), plane(...d)], color, { stroke: "#8e9aa5", strokeWidth: 0.35 });
    }
    addCylinder(group, axis, center, radius * 0.24, 0.12, "#9aabb5", 20);
    addCylinder(group, axis, center, radius * 0.10, 0.13, "#56d8b3", 16);
  }

  function addSegment(group, start, end, width, color) {
    const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2];
    const length = Math.hypot(dx, dy, dz) || 1;
    let ux = -dy / length, uy = dx / length, uz = 0;
    const ulen = Math.hypot(ux, uy, uz) || 1;
    ux /= ulen; uy /= ulen;
    let vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    const vlen = Math.hypot(vx, vy, vz) || 1;
    vx /= vlen; vy /= vlen; vz /= vlen;
    const p = (point, a, b) => [point[0] + ux * a + vx * b, point[1] + uy * a + vy * b, point[2] + uz * a + vz * b];
    const w = width / 2;
    addFace(group, [p(start, -w, -w), p(end, -w, -w), p(end, w, -w), p(start, w, -w)], color);
    addFace(group, [p(start, w, w), p(end, w, w), p(end, -w, w), p(start, -w, w)], color);
    addFace(group, [p(start, -w, -w), p(start, w, -w), p(start, w, w), p(start, -w, w)], color);
    addFace(group, [p(end, -w, -w), p(end, -w, w), p(end, w, w), p(end, w, -w)], color);
  }

  function addBoard(group, board) {
    const factor = board?.compatibility?.formFactor === "Mini-ITX" ? 0.68 : board?.compatibility?.formFactor === "Micro-ATX" ? 0.83 : 1;
    const x = -0.83, y = 0.42, z = 2.45, width = 2.5 * factor, height = 3.82 * factor;
    addBox(group, [x, y, z], [0.10, width, height], palettes.motherboard);
    addBox(group, [x - 0.065, y - width * 0.34, z + height * 0.40], [0.08, width * 0.26, 0.35], "#53656b");
    addBox(group, [x - 0.065, y - width * 0.36, z + height * 0.27], [0.08, width * 0.23, 0.25], "#374951");
    addBox(group, [x - 0.065, y + width * 0.30, z + height * 0.40], [0.08, 0.40, 0.34], "#45585c");
    addBox(group, [x - 0.065, y - width * 0.39, z - height * 0.33], [0.08, 0.16, 0.72], "#263b3b");
    for (let i = 0; i < 4; i++) addBox(group, [x - 0.11, y + width * 0.31 + i * 0.105, z + height * 0.08], [0.045, 0.045, height * 0.61], i % 2 ? "#213444" : "#304b5b");
    for (let i = 0; i < 3; i++) addBox(group, [x - 0.105, y - 0.34 + i * 0.12, z - height * 0.30], [0.04, 1.55, 0.075], i === 1 ? "#7e9a9c" : "#27333a");
    for (let i = 0; i < 8; i++) addCylinder(group, "x", [x - 0.13, y - width * 0.47 + (i % 2) * 0.08, z - height * 0.42 + Math.floor(i / 2) * 0.08], 0.035, 0.04, "#a7b8b1", 12);
    return { x, y, z, width, height };
  }

  function buildScene() {
    view.faces = [];
    const picked = (category) => view.selected.find((part) => part.category === category);
    const pcCase = picked("case"), board = picked("motherboard"), cpu = picked("cpu"), ram = picked("memory");
    const gpu = picked("gpu"), cooler = picked("cooler"), psu = picked("psu");
    const hasCase = Boolean(pcCase);
    const caseW = 2.5, caseD = 4.4, caseH = 5.0, frontY = -caseD / 2, shellX = -caseW / 2, farX = caseW / 2;

    if (hasCase) {
      addBox("case", [farX, 0, caseH / 2], [0.13, caseD, caseH], palettes.case);
      addBox("case", [0, 0, 0.08], [caseW, caseD, 0.16], "#202c37");
      addBox("case", [0, 0, caseH - 0.08], [caseW, caseD, 0.16], "#202c37");
      for (const x of [shellX + 0.06, farX - 0.06]) for (const y of [frontY + 0.08, caseD / 2 - 0.08]) addBox("case", [x, y, caseH / 2], [0.12, 0.16, caseH], "#41505b");
      for (const z of [0.12, caseH - 0.12]) addBox("case", [0, frontY + 0.08, z], [caseW, 0.16, 0.14], "#43535f");
      for (const x of [-0.48, 0.48]) addDiscFan("case", "y", [x, frontY - 0.035, 2.75], 0.67, "#334550", 9);
      addBox("case", [0, frontY - 0.10, caseH / 2], [0.09, 0.10, caseH - 0.42], "#111a22", { opacity: 0.35 });
      for (const x of [-0.85, 0.85]) addBox("case", [x, 0, 0.12], [0.22, 0.34, 0.23], "#1b252e");
      addBox("case", [0.72, -0.12, 0.93], [0.92, 2.75, 1.35], "#252f38");
      addBox("case", [0.75, -0.12, 1.63], [0.94, 2.78, 0.045], "#384651");
    }

    const boardOrigin = board ? addBoard("motherboard", board) : null;
    if (boardOrigin) {
      addBox("motherboard", [-0.91, boardOrigin.y - 0.24, boardOrigin.z + 0.45], [0.13, 0.79, 0.76], "#2b3943");
      addBox("motherboard", [-0.99, boardOrigin.y - 0.24, boardOrigin.z + 0.45], [0.035, 0.52, 0.50], "#758793");
      for (let i = 0; i < 10; i++) addBox("motherboard", [-0.92, boardOrigin.y - 0.52 + (i % 5) * 0.14, boardOrigin.z + 0.02 + Math.floor(i / 5) * 0.15], [0.045, 0.06, 0.06], "#c1a466");
      for (let i = 0; i < 4; i++) addBox("motherboard", [-0.94, boardOrigin.y + 0.72 + i * 0.095, boardOrigin.z + 0.43], [0.06, 0.052, 2.18], i % 2 ? "#1f2a36" : "#273744");
      for (let i = 0; i < 4; i++) addBox("motherboard", [-0.95, boardOrigin.y - 0.23 + i * 0.10, boardOrigin.z - 1.18], [0.055, 0.045, 0.045], "#829393");
    }

    if (cpu) {
      addBox("cpu", [-1.02, -0.02, 3.35], [0.16, 0.62, 0.62], "#a5b3bd");
      addBox("cpu", [-1.115, -0.02, 3.35], [0.055, 0.49, 0.49], "#687c8a");
      addBox("cpu", [-1.15, -0.02, 3.35], [0.02, 0.32, 0.20], "#b4c1c6");
      if (!cooler && cpu.specs.coolerIncluded) {
        addBox("cpu", [-0.67, -0.02, 3.56], [0.68, 0.72, 0.48], "#555f69");
        for (let i = 0; i < 6; i++) addBox("cpu", [-0.30 - i * 0.075, -0.02, 3.56], [0.035, 0.78, 0.54], "#81909b");
        addDiscFan("cpu", "x", [-0.23, -0.02, 3.56], 0.27, "#293744", 7);
      }
    }

    if (ram) {
      const moduleCount = Math.max(1, Math.min(4, ram.specs.modules || 2));
      for (let i = 0; i < moduleCount; i++) {
        const y = 0.86 + i * 0.105;
        addBox("memory", [-0.98, y, 3.46], [0.09, 0.085, 1.68], palettes.memory);
        addBox("memory", [-1.035, y, 3.50], [0.025, 0.046, 1.36], "#4c6d82");
        addBox("memory", [-1.055, y, 4.22], [0.028, 0.056, 0.22], "#73dfbd");
        for (let j = 0; j < 8; j++) addBox("memory", [-1.04, y, 2.86 + j * 0.16], [0.025, 0.052, 0.075], "#9da9aa");
      }
    }

    for (const drive of view.selected.filter((part) => part.category === "storage")) {
      const index = view.selected.filter((part) => part.category === "storage").indexOf(drive);
      const y = -0.45 + index * 0.48, z = 2.62 + (index % 2) * 0.22;
      addBox("storage", [-1.05, y, z], [0.07, 0.78, 0.22], palettes.storage);
      addBox("storage", [-1.095, y + 0.08, z + 0.012], [0.025, 0.25, 0.14], "#738389");
      for (let i = 0; i < 3; i++) addBox("storage", [-1.10, y - 0.20 + i * 0.17, z + 0.014], [0.025, 0.09, 0.13], i === 1 ? "#6e7d82" : "#394b55");
      addBox("storage", [-1.10, y - 0.38, z], [0.03, 0.05, 0.18], "#c3a15c");
    }

    if (gpu) {
      const cardLength = gpu.compatibility.lengthMm ? Math.max(2.7, Math.min(3.7, gpu.compatibility.lengthMm / 95)) : 3.25;
      const center = [-0.26, 0.14, 1.95];
      addBox("gpu", center, [0.56, cardLength, 0.77], palettes.gpu);
      addBox("gpu", [-0.55, 0.14, 2.31], [0.08, cardLength * 0.94, 0.10], "#596877");
      addBox("gpu", [-0.57, 0.14, 1.63], [0.05, cardLength * 0.92, 0.10], "#6d7a84");
      const fanCount = cardLength > 3.1 ? 3 : 2;
      for (let i = 0; i < fanCount; i++) {
        const fanY = 0.14 - cardLength / 2 + 0.55 + i * ((cardLength - 1.1) / Math.max(1, fanCount - 1));
        addDiscFan("gpu", "x", [-0.57, fanY, 1.95], 0.43, "#3c4854", 9);
      }
      addBox("gpu", [-0.16, 0.14 - cardLength / 2 + 0.14, 1.96], [0.55, 0.12, 0.72], "#9aa7a9");
      for (let i = 0; i < 6; i++) addBox("gpu", [0.11, 0.14 - cardLength / 2 + 0.16 + i * 0.085, 1.94], [0.02, 0.045, 0.48], "#c5ab6b");
    }

    if (cooler) {
      if (cooler.specs.coolingType === "Air") {
        addBox("cooler", [-0.37, -0.04, 3.40], [0.86, 0.79, 1.24], "#677884");
        for (let i = 0; i < 12; i++) addBox("cooler", [-0.80 + i * 0.078, -0.04, 3.40], [0.035, 0.90, 1.30], i % 2 ? "#85949b" : "#a1acaf");
        addDiscFan("cooler", "x", [-0.91, -0.04, 3.40], 0.47, "#293540", 7);
        addBox("cooler", [-0.92, -0.04, 3.40], [0.045, 0.86, 0.09], "#4f626e");
      } else {
        addBox("cooler", [-0.77, -0.02, 3.35], [0.30, 0.48, 0.48], "#4e5b65");
        addBox("cooler", [-0.95, -0.02, 3.35], [0.08, 0.30, 0.30], "#7a8a92");
        addBox("cooler", [-0.15, 0.60, 4.72], [1.82, 2.50, 0.27], "#46545e");
        const radCount = cooler.specs.radiatorSizeMm >= 360 ? 3 : 2;
        for (let i = 0; i < radCount; i++) addDiscFan("cooler", "z", [-0.52 + i * 0.55, 0.60, 4.55], 0.37, "#34434d", 8);
        for (let i = 0; i < 9; i++) addBox("cooler", [0.80, -0.54 + i * 0.27, 4.71], [0.06, 0.045, 0.20], "#85929a");
        addSegment("cooler", [-0.77, -0.02, 3.35], [-0.28, 0.40, 4.55], 0.075, "#1e282e");
        addSegment("cooler", [-0.76, 0.03, 3.38], [0.10, 0.54, 4.55], 0.075, "#25343b");
      }
    }

    if (psu) {
      addBox("psu", [0.67, 0.15, 0.97], [0.92, 2.28, 1.02], palettes.psu);
      addDiscFan("psu", "z", [0.67, 0.15, 1.50], 0.42, "#252d34", 9);
      addBox("psu", [0.67, -1.02, 0.97], [0.66, 0.06, 0.62], "#28343c");
      for (let i = 0; i < 6; i++) addBox("psu", [0.37 + (i % 3) * 0.30, -1.06, 0.75 + Math.floor(i / 3) * 0.18], [0.12, 0.035, 0.09], "#b2a36d");
      for (let i = 0; i < 5; i++) addBox("psu", [0.22 + i * 0.20, 0.46, 1.49], [0.05, 0.05, 0.06], "#9babb1");
    }

    if (psu && board) {
      addSegment("psu", [0.20, -0.85, 1.22], [-0.50, -0.52, 2.25], 0.065, "#e8b756");
      addSegment("psu", [0.18, -0.75, 1.21], [-0.58, 0.28, 1.96], 0.060, "#303a47");
      if (gpu) addSegment("psu", [0.14, 0.35, 1.29], [-0.14, 0.70, 2.22], 0.09, "#26313d");
    }

    if (picked("monitor")) {
      const x = 5.15, y = 0.25, z = 3.45;
      addBox("monitor", [x, y + 0.04, z], [2.80, 0.15, 1.68], palettes.monitor);
      addBox("monitor", [x, y - 0.045, z], [2.58, 0.025, 1.46], "#316177");
      addBox("monitor", [x, y - 0.065, z], [2.48, 0.018, 1.36], "#173547");
      addBox("monitor", [x, y + 0.13, 2.42], [0.18, 0.31, 0.80], "#59636d");
      addBox("monitor", [x, y - 0.01, 1.96], [1.05, 0.62, 0.12], "#4a5863");
      addBox("monitor", [x, y - 0.07, 2.48], [0.42, 0.028, 0.045], "#b3c2c6");
      for (let i = 0; i < 18; i++) addBox("monitor", [x - 1.08 + i * 0.127, y - 0.085, 2.77 + i * 0.018], [0.012, 0.012, 0.035], "#64dabb");
    }

    if (picked("webcam")) {
      const x = 5.15, y = 0.10, z = picked("monitor") ? 4.35 : 2.9;
      addBox("webcam", [x, y, z], [0.86, 0.31, 0.26], palettes.webcam);
      addBox("webcam", [x, y - 0.17, z], [0.72, 0.025, 0.17], "#404d58");
      addCylinder("webcam", "y", [x, y - 0.20, z], 0.115, 0.08, "#111a21", 24);
      addCylinder("webcam", "y", [x, y - 0.25, z], 0.064, 0.025, "#4f7d94", 20);
      addBox("webcam", [x, y + 0.03, z - 0.25], [0.28, 0.18, 0.28], "#48545f");
    }

    if (picked("keyboard")) {
      const x = 5.05, y = -1.62, z = 0.72;
      addBox("keyboard", [x, y, z], [2.55, 0.90, 0.16], palettes.keyboard);
      addBox("keyboard", [x, y - 0.02, z + 0.09], [2.37, 0.73, 0.045], "#182129");
      for (let row = 0; row < 5; row++) {
        const count = row === 4 ? 9 : 15;
        for (let col = 0; col < count; col++) {
          const keyX = x - 1.04 + col * (2.08 / Math.max(1, count - 1));
          const keyY = y - 0.30 + row * 0.145;
          const width = row === 4 && col === 4 ? 0.46 : 0.105;
          addBox("keyboard", [keyX, keyY, z + 0.17], [width, 0.105, 0.11], (row === 0 && col % 4 === 0) ? "#5a737c" : "#3b4955");
        }
      }
      addBox("keyboard", [x, y - 0.44, z + 0.14], [0.34, 0.06, 0.06], "#55caa7");
    }

    if (picked("mouse")) {
      const x = 7.08, y = -1.58, z = 0.82;
      addBox("mouse", [x, y, z], [0.52, 0.73, 0.33], palettes.mouse);
      addBox("mouse", [x, y - 0.10, z + 0.18], [0.045, 0.30, 0.045], "#8e9da4");
      addCylinder("mouse", "z", [x, y - 0.095, z + 0.225], 0.075, 0.11, "#aebbbf", 18);
      addBox("mouse", [x, y + 0.19, z + 0.17], [0.14, 0.12, 0.03], "#647b88");
    }

    if (picked("headset")) {
      const x = 7.08, y = 0.90, z = 2.45, radius = 0.68;
      let previous = null;
      for (let i = 0; i <= 14; i++) {
        const angle = Math.PI + i * Math.PI / 14;
        const point = [x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius];
        if (previous) addSegment("headset", previous, point, 0.13, "#46535e");
        previous = point;
      }
      addBox("headset", [x - radius, y, z - 0.11], [0.33, 0.37, 0.69], palettes.headset);
      addBox("headset", [x + radius, y, z - 0.11], [0.33, 0.37, 0.69], palettes.headset);
      addCylinder("headset", "x", [x - radius - 0.18, y, z - 0.11], 0.25, 0.08, "#1a222a", 24);
      addCylinder("headset", "x", [x + radius + 0.18, y, z - 0.11], 0.25, 0.08, "#1a222a", 24);
      addSegment("headset", [x + radius + 0.12, y - 0.1, z - 0.35], [x + radius + 0.38, y - 0.22, z - 0.70], 0.045, "#9aa9ad");
    }
  }

  function explodeOffset(group) {
    if (view.mode !== "exploded") return [0, 0, 0];
    const offsets = {
      cpu: [-0.85, -0.25, 0.52], motherboard: [0, 0, 0.34], memory: [-0.38, 1.05, 0.42],
      storage: [-0.22, -0.15, 0.70], cooler: [-0.75, -0.15, 1.18], gpu: [0.05, 0.08, -0.72], psu: [0.70, 0.12, -0.26]
    };
    return offsets[group] || [0, 0, 0];
  }

  function rotate(point, offset = [0, 0, 0]) {
    const x = point[0] + offset[0], y = point[1] + offset[1], z = point[2] + offset[2];
    const cosY = Math.cos(view.yaw), sinY = Math.sin(view.yaw), cosP = Math.cos(view.pitch), sinP = Math.sin(view.pitch);
    const horizontal = x * sinY + y * cosY;
    return { x: x * cosY - y * sinY, y: z * cosP - horizontal * sinP, depth: -horizontal * cosP + z * sinP };
  }

  function normalShade(points) {
    if (points.length < 3) return 0.82;
    const a = points[0], b = points[1], c = points[2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const n = Math.hypot(nx, ny, nz) || 1; nx /= n; ny /= n; nz /= n;
    return 0.63 + Math.max(0, nx * -0.43 + ny * -0.58 + nz * 0.68) * 0.42;
  }

  function render() {
    if (!view.canvas || !view.ctx) return;
    const width = view.canvas.clientWidth, height = view.canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (view.canvas.width !== Math.round(width * dpr) || view.canvas.height !== Math.round(height * dpr)) {
      view.dpr = dpr;
      view.canvas.width = Math.round(width * dpr);
      view.canvas.height = Math.round(height * dpr);
    }
    const ctx = view.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const prepared = [];
    for (const face of view.faces) {
      const offset = explodeOffset(face.group);
      const points = face.points.map((point) => rotate(point, offset));
      prepared.push({ ...face, points, depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length, brightness: normalShade(face.points) });
    }
    if (!prepared.length) {
      ctx.fillStyle = "#8da1b2"; ctx.font = "600 14px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Your assembly will appear here", width / 2, height / 2 - 5);
      ctx.fillStyle = "#63798c"; ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.fillText("Add a case and components from the catalog to begin", width / 2, height / 2 + 18);
      return;
    }
    const minX = Math.min(...prepared.flatMap((face) => face.points.map((point) => point.x)));
    const maxX = Math.max(...prepared.flatMap((face) => face.points.map((point) => point.x)));
    const minY = Math.min(...prepared.flatMap((face) => face.points.map((point) => point.y)));
    const maxY = Math.max(...prepared.flatMap((face) => face.points.map((point) => point.y)));
    const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
    const scale = Math.min((width - 70) / spanX, (height - 70) / spanY) * view.zoom;
    const centerX = width / 2 + view.panX - ((minX + maxX) / 2) * scale;
    const centerY = height / 2 + view.panY + ((minY + maxY) / 2) * scale;
    const project = (point) => [centerX + point.x * scale, centerY - point.y * scale];
    prepared.sort((a, b) => a.depth - b.depth);
    for (const face of prepared) {
      const isDimmed = view.focus !== "all" && face.group !== view.focus;
      const alpha = face.opacity * (isDimmed ? 0.12 : 1);
      const color = colorShade(face.color, face.brightness);
      const first = project(face.points[0]);
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(first[0], first[1]);
      for (let i = 1; i < face.points.length; i++) { const p = project(face.points[i]); ctx.lineTo(p[0], p[1]); }
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = face.stroke || "#a9bac4"; ctx.lineWidth = face.strokeWidth; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (view.mode === "exploded") {
      ctx.fillStyle = "#a9c2d1"; ctx.font = "11px Inter, system-ui, sans-serif"; ctx.textAlign = "left";
      ctx.fillText("Exploded view · components separated to reveal their shapes", 18, height - 18);
    }
  }

  function updateLegend() {
    const host = $("#assembly-legend");
    const status = $("#assembly-summary");
    if (!host || !status) return;
    const categories = [...new Set(view.selected.map((part) => part.category))];
    host.innerHTML = categories.length ? `<button type="button" class="model-chip ${view.focus === "all" ? "active" : ""}" data-focus="all">Show all</button>${categories.map((category) => {
      const part = view.selected.find((item) => item.category === category);
      const selected = view.focus === category;
      return `<button type="button" class="model-chip ${selected ? "active" : ""}" data-focus="${category}" aria-pressed="${selected}" title="Focus ${part.name}">${labels[category] || category}<span>${part.name}</span></button>`;
    }).join("")}` : `<span class="assembly-empty-label">No components selected</span>`;
    host.querySelectorAll("[data-focus]").forEach((button) => button.addEventListener("click", () => {
      view.focus = button.dataset.focus;
      updateLegend(); render();
      const part = view.selected.find((item) => item.category === view.focus);
      status.textContent = part ? `Focusing on ${part.name}. Other components are dimmed.` : "Showing all selected components.";
    }));
    status.textContent = view.selected.length
      ? `${view.selected.length} selected ${view.selected.length === 1 ? "part" : "parts"} · Parametric models use catalog details where available; unspecified dimensions are illustrative.`
      : "Add components to see the 3D assembly.";
  }

  function setMode(mode) {
    view.mode = mode;
    document.querySelectorAll("[data-assembly-mode]").forEach((button) => {
      const active = button.dataset.assemblyMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    render();
  }

  function mount() {
    view.canvas = $("#assembly-canvas");
    if (!view.canvas) return;
    view.ctx = view.canvas.getContext("2d");
    const bounds = view.canvas.getBoundingClientRect();
    view.canvas.width = Math.max(1, Math.round(bounds.width * Math.min(window.devicePixelRatio || 1, 2)));
    view.canvas.height = Math.max(1, Math.round(bounds.height * Math.min(window.devicePixelRatio || 1, 2)));
    const resize = new ResizeObserver(() => render());
    resize.observe(view.canvas);
    view.canvas.addEventListener("pointerdown", (event) => {
      view.dragging = true; view.moved = false; view.lastX = event.clientX; view.lastY = event.clientY;
      view.canvas.classList.add("dragging"); view.canvas.setPointerCapture(event.pointerId);
    });
    view.canvas.addEventListener("pointermove", (event) => {
      if (!view.dragging) return;
      const dx = event.clientX - view.lastX, dy = event.clientY - view.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) view.moved = true;
      view.yaw += dx * 0.009; view.pitch = Math.max(-0.08, Math.min(1.18, view.pitch - dy * 0.007));
      view.lastX = event.clientX; view.lastY = event.clientY; render();
    });
    const stopDrag = () => { view.dragging = false; view.canvas.classList.remove("dragging"); };
    view.canvas.addEventListener("pointerup", stopDrag);
    view.canvas.addEventListener("pointercancel", stopDrag);
    view.canvas.addEventListener("wheel", (event) => {
      event.preventDefault(); view.zoom = Math.max(0.58, Math.min(2.4, view.zoom * (event.deltaY < 0 ? 1.08 : 0.92))); render();
    }, { passive: false });
    view.canvas.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") view.yaw -= 0.12;
      else if (event.key === "ArrowRight") view.yaw += 0.12;
      else if (event.key === "ArrowUp") view.pitch = Math.min(1.18, view.pitch + 0.09);
      else if (event.key === "ArrowDown") view.pitch = Math.max(-0.08, view.pitch - 0.09);
      else if (event.key === "+" || event.key === "=") view.zoom = Math.min(2.4, view.zoom * 1.1);
      else if (event.key === "-") view.zoom = Math.max(0.58, view.zoom * 0.9);
      else return;
      event.preventDefault(); render();
    });
    document.querySelectorAll("[data-assembly-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.assemblyMode)));
    $("#assembly-reset")?.addEventListener("click", () => { view.yaw = 0.72; view.pitch = 0.43; view.zoom = 1; view.panX = 0; view.panY = 0; view.focus = "all"; updateLegend(); render(); });
    $("#assembly-home")?.addEventListener("click", () => { view.focus = "all"; view.panX = 0; view.panY = 0; view.zoom = 1; updateLegend(); render(); });
    window.addEventListener("resize", render);
    render();
  }

  function update(selected) {
    view.selected = Array.isArray(selected) ? selected : [];
    if (view.focus !== "all" && !view.selected.some((part) => part.category === view.focus)) view.focus = "all";
    buildScene(); updateLegend(); render();
  }

  window.PCForgeAssembly = { mount, update };
})();
