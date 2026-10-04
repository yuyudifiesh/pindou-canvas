
    const imageInput = document.getElementById("imageInput");
    const dropZone = document.getElementById("dropZone");
    const fileName = document.getElementById("fileName");
    const cropper = document.getElementById("cropper");
    const cropCanvas = document.getElementById("cropCanvas");
    const cropZoom = document.getElementById("cropZoom");
    const cropX = document.getElementById("cropX");
    const cropY = document.getElementById("cropY");
    const beadWidth = document.getElementById("beadWidth");
    const colorCount = document.getElementById("colorCount");
    const beadSize = document.getElementById("beadSize");
    const gapSize = document.getElementById("gapSize");
    const colorStyle = document.getElementById("colorStyle");
    const denoiseToggle = document.getElementById("denoiseToggle");
    const boardToggle = document.getElementById("boardToggle");
    const boardSize = document.getElementById("boardSize");
    const boardSummary = document.getElementById("boardSummary");
    const canvasViewport = document.getElementById("canvasViewport");
    const canvasStage = document.getElementById("canvasStage");
    const beadCanvas = document.getElementById("beadCanvas");
    const boardOverlay = document.getElementById("boardOverlay");
    const zoomLevel = document.getElementById("zoomLevel");
    const swatches = document.getElementById("swatches");
    const statusText = document.getElementById("statusText");
    const emptyNote = document.getElementById("emptyNote");
    const toast = document.getElementById("toast");

    const outputs = {
      beadWidth: document.getElementById("beadWidthValue"),
      colorCount: document.getElementById("colorCountValue"),
      beadSize: document.getElementById("beadSizeValue"),
      gapSize: document.getElementById("gapSizeValue"),
      cropZoom: document.getElementById("cropZoomValue"),
      cropX: document.getElementById("cropXValue"),
      cropY: document.getElementById("cropYValue")
    };

    const metrics = {
      size: document.getElementById("metricSize"),
      colors: document.getElementById("metricColors"),
      beads: document.getElementById("metricBeads"),
      canvas: document.getElementById("metricCanvas")
    };

    const state = {
      image: null,
      sourceName: "",
      shape: "square",
      cells: [],
      palette: [],
      rows: 72,
      cols: 72,
      crop: {
        zoom: 1,
        x: 0,
        y: 0
      }
    };

    const viewState = {
      zoom: 1,
      minZoom: 0.25,
      maxZoom: 3,
      userAdjusted: false,
      dragging: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      startScrollLeft: 0,
      startScrollTop: 0
    };

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function showToast(message) {
      toast.textContent = message;
      toast.classList.add("is-visible");
      window.clearTimeout(showToast.timer);
      showToast.timer = window.setTimeout(() => {
        toast.classList.remove("is-visible");
      }, 2300);
    }

    function rgbToHex(rgb) {
      return "#" + rgb.map((value) => {
        const part = clamp(Math.round(value), 0, 255).toString(16);
        return part.length === 1 ? "0" + part : part;
      }).join("");
    }

    function getBoardLayout() {
      const size = Number(boardSize.value);
      const columns = Math.ceil(state.cols / size);
      const rows = Math.ceil(state.rows / size);
      return { size, columns, rows, total: columns * rows };
    }

    function updateBoardSummary() {
      const layout = getBoardLayout();
      boardSummary.textContent = `${layout.columns} x ${layout.rows}，共 ${layout.total} 块底板；PDF 会按此规格分页。`;
    }

    function updateCanvasPannable() {
      const isPannable = canvasStage.offsetWidth > canvasViewport.clientWidth - 20
        || canvasStage.offsetHeight > canvasViewport.clientHeight - 72;
      canvasViewport.classList.toggle("is-pannable", isPannable);
    }

    function applyCanvasZoom(preserveCenter = true) {
      const oldScrollWidth = Math.max(1, canvasViewport.scrollWidth);
      const oldScrollHeight = Math.max(1, canvasViewport.scrollHeight);
      const centerX = (canvasViewport.scrollLeft + canvasViewport.clientWidth / 2) / oldScrollWidth;
      const centerY = (canvasViewport.scrollTop + canvasViewport.clientHeight / 2) / oldScrollHeight;

      canvasStage.style.width = `${Math.max(1, beadCanvas.width * viewState.zoom)}px`;
      canvasStage.style.height = `${Math.max(1, beadCanvas.height * viewState.zoom)}px`;
      zoomLevel.value = `${Math.round(viewState.zoom * 100)}%`;

      window.requestAnimationFrame(() => {
        if (preserveCenter) {
          canvasViewport.scrollLeft = centerX * canvasViewport.scrollWidth - canvasViewport.clientWidth / 2;
          canvasViewport.scrollTop = centerY * canvasViewport.scrollHeight - canvasViewport.clientHeight / 2;
        }
        updateCanvasPannable();
      });
    }

    function setCanvasZoom(nextZoom) {
      viewState.zoom = clamp(nextZoom, viewState.minZoom, viewState.maxZoom);
      viewState.userAdjusted = true;
      applyCanvasZoom(true);
    }

    function fitCanvas() {
      const availableWidth = Math.max(160, canvasViewport.clientWidth - 40);
      const availableHeight = Math.max(160, canvasViewport.clientHeight - 92);
      viewState.zoom = clamp(
        Math.min(1, availableWidth / beadCanvas.width, availableHeight / beadCanvas.height),
        viewState.minZoom,
        viewState.maxZoom
      );
      viewState.userAdjusted = false;
      applyCanvasZoom(false);
      canvasViewport.scrollLeft = 0;
      canvasViewport.scrollTop = 0;
    }

    function syncCanvasView() {
      window.requestAnimationFrame(() => {
        if (viewState.userAdjusted) {
          applyCanvasZoom(false);
        } else {
          fitCanvas();
        }
      });
    }

    function drawBoardOverlay() {
      if (boardOverlay.width !== beadCanvas.width || boardOverlay.height !== beadCanvas.height) {
        boardOverlay.width = beadCanvas.width;
        boardOverlay.height = beadCanvas.height;
      }

      const ctx = boardOverlay.getContext("2d");
      ctx.clearRect(0, 0, boardOverlay.width, boardOverlay.height);
      updateBoardSummary();
      boardOverlay.style.display = boardToggle.checked ? "block" : "none";
      if (!boardToggle.checked || !state.cells.length) return;

      const layout = getBoardLayout();
      const size = Number(beadSize.value);
      const gap = Number(gapSize.value);
      const unit = size + gap;
      const lineWidth = clamp(unit * 0.32, 2, 4);
      const fontSize = clamp(unit * 1.5, 12, 18);

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = "rgba(216, 61, 104, 0.92)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = `800 ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let row = 0; row < layout.rows; row += 1) {
        for (let column = 0; column < layout.columns; column += 1) {
          const startColumn = column * layout.size;
          const endColumn = Math.min(state.cols, startColumn + layout.size);
          const startRow = row * layout.size;
          const endRow = Math.min(state.rows, startRow + layout.size);
          const x = startColumn * unit + gap;
          const y = startRow * unit + gap;
          const width = endColumn * unit - x;
          const height = endRow * unit - y;
          ctx.strokeRect(x + lineWidth / 2, y + lineWidth / 2, width - lineWidth, height - lineWidth);

          const label = `${String.fromCharCode(65 + row)}${column + 1}`;
          const labelWidth = Math.max(30, fontSize * 2.3);
          const labelHeight = Math.max(20, fontSize * 1.55);
          const labelX = x + lineWidth + 3;
          const labelY = y + lineWidth + 3;
          ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
          ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
          ctx.fillStyle = "#c92f5d";
          ctx.fillText(label, labelX + labelWidth / 2, labelY + labelHeight / 2);
        }
      }
    }

    function colorDistance(a, b) {
      const dr = a[0] - b[0];
      const dg = a[1] - b[1];
      const db = a[2] - b[2];
      return dr * dr + dg * dg + db * db;
    }

    function adjustColor(rgb, mode) {
      const [r, g, b] = rgb;
      if (mode === "gray") {
        const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        return [y, y, y];
      }

      const factor = mode === "vivid" ? 1.18 : mode === "soft" ? 0.72 : 1;
      const brighten = mode === "soft" ? 18 : mode === "vivid" ? 3 : 0;
      const avg = (r + g + b) / 3;
      return [
        clamp(avg + (r - avg) * factor + brighten, 0, 255),
        clamp(avg + (g - avg) * factor + brighten, 0, 255),
        clamp(avg + (b - avg) * factor + brighten, 0, 255)
      ];
    }

    function updateCropOutputs() {
      state.crop.zoom = Number(cropZoom.value) / 100;
      state.crop.x = Number(cropX.value);
      state.crop.y = Number(cropY.value);
      outputs.cropZoom.value = Math.round(state.crop.zoom * 100);
      outputs.cropX.value = state.crop.x;
      outputs.cropY.value = state.crop.y;
    }

    function getCropRect(image, targetRatio) {
      const imageRatio = image.naturalWidth / image.naturalHeight;
      let baseWidth = image.naturalWidth;
      let baseHeight = image.naturalHeight;

      if (imageRatio > targetRatio) {
        baseWidth = image.naturalHeight * targetRatio;
      } else {
        baseHeight = image.naturalWidth / targetRatio;
      }

      const cropWidth = baseWidth / state.crop.zoom;
      const cropHeight = baseHeight / state.crop.zoom;
      const maxX = Math.max(0, (image.naturalWidth - cropWidth) / 2);
      const maxY = Math.max(0, (image.naturalHeight - cropHeight) / 2);
      const centerX = image.naturalWidth / 2 + maxX * (state.crop.x / 100);
      const centerY = image.naturalHeight / 2 + maxY * (state.crop.y / 100);

      return {
        x: clamp(centerX - cropWidth / 2, 0, image.naturalWidth - cropWidth),
        y: clamp(centerY - cropHeight / 2, 0, image.naturalHeight - cropHeight),
        width: cropWidth,
        height: cropHeight
      };
    }

    function drawCroppedImage(ctx, image, width, height) {
      const rect = getCropRect(image, width / height);
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
    }

    function renderCropPreview() {
      updateCropOutputs();
      const ctx = cropCanvas.getContext("2d");
      ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
      ctx.fillStyle = "#fbfdff";
      ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

      if (!state.image) {
        cropper.classList.remove("is-visible");
        return;
      }

      cropper.classList.add("is-visible");
      drawCroppedImage(ctx, state.image, cropCanvas.width, cropCanvas.height);
      ctx.strokeStyle = "rgba(255,255,255,0.82)";
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 16, cropCanvas.width - 32, cropCanvas.height - 32);
    }

    function getNearestPaletteIndex(rgb, palette) {
      let bestIndex = 0;
      let bestDistance = Infinity;
      palette.forEach((color, index) => {
        const distance = colorDistance(rgb, color);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      return bestIndex;
    }

    function buildPalette(pixels, requestedCount) {
      const unique = [];
      const seen = new Set();
      pixels.forEach((pixel) => {
        const bucket = pixel.map((value) => Math.round(value / 16) * 16).join(",");
        if (!seen.has(bucket)) {
          seen.add(bucket);
          unique.push(pixel);
        }
      });

      const k = Math.min(requestedCount, unique.length || 1);
      const centers = [];
      for (let i = 0; i < k; i += 1) {
        const index = Math.floor((i / Math.max(1, k - 1)) * (unique.length - 1));
        centers.push([unique[index][0], unique[index][1], unique[index][2]]);
      }

      for (let round = 0; round < 8; round += 1) {
        const groups = Array.from({ length: k }, () => ({ count: 0, sum: [0, 0, 0] }));
        pixels.forEach((pixel) => {
          const index = getNearestPaletteIndex(pixel, centers);
          groups[index].count += 1;
          groups[index].sum[0] += pixel[0];
          groups[index].sum[1] += pixel[1];
          groups[index].sum[2] += pixel[2];
        });

        groups.forEach((group, index) => {
          if (group.count > 0) {
            centers[index] = [
              group.sum[0] / group.count,
              group.sum[1] / group.count,
              group.sum[2] / group.count
            ];
          }
        });
      }

      return centers.map((center) => center.map((value) => Math.round(value)));
    }

    function getImagePixels(image, cols, rows, mode) {
      const scratch = document.createElement("canvas");
      scratch.width = cols;
      scratch.height = rows;
      const ctx = scratch.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#fbfdff";
      ctx.fillRect(0, 0, cols, rows);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      drawCroppedImage(ctx, image, cols, rows);

      const data = ctx.getImageData(0, 0, cols, rows).data;
      const pixels = [];
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] / 255;
        const rgb = [
          data[i] * alpha + 251 * (1 - alpha),
          data[i + 1] * alpha + 253 * (1 - alpha),
          data[i + 2] * alpha + 255 * (1 - alpha)
        ];
        pixels.push(adjustColor(rgb, mode));
      }
      return pixels;
    }

    function cleanupSpeckles(cells, cols, rows) {
      let next = cells.slice();

      for (let pass = 0; pass < 2; pass += 1) {
        const source = next;
        next = source.slice();

        for (let y = 0; y < rows; y += 1) {
          for (let x = 0; x < cols; x += 1) {
            const index = y * cols + x;
            const currentHex = rgbToHex(source[index]);
            const counts = new Map();
            let sameNeighbors = 0;

            for (let dy = -1; dy <= 1; dy += 1) {
              for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                const neighbor = source[ny * cols + nx];
                const hex = rgbToHex(neighbor);
                if (hex === currentHex) sameNeighbors += 1;
                const item = counts.get(hex) || { rgb: neighbor, count: 0 };
                item.count += 1;
                counts.set(hex, item);
              }
            }

            const dominant = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0];
            if (dominant && sameNeighbors <= 1 && dominant.count >= 4) {
              next[index] = dominant.rgb;
            }
          }
        }
      }

      return next;
    }

    function generatePattern() {
      const cols = Number(beadWidth.value);
      const mode = colorStyle.value;
      updateCropOutputs();
      outputs.beadWidth.value = cols;
      outputs.colorCount.value = colorCount.value;
      outputs.beadSize.value = beadSize.value;
      outputs.gapSize.value = gapSize.value;
      renderCropPreview();

      if (!state.image) {
        state.cols = 0;
        state.rows = 0;
        state.cells = [];
        state.palette = [];
        drawPattern();
        statusText.textContent = "等待上传照片";
        return;
      }

      const rows = clamp(Math.round(cols * state.image.naturalHeight / state.image.naturalWidth), 8, 96);
      state.cols = cols;
      state.rows = rows;
      const pixels = getImagePixels(state.image, cols, rows, mode);
      const palette = buildPalette(pixels, Number(colorCount.value));
      state.palette = palette;
      state.cells = pixels.map((pixel) => palette[getNearestPaletteIndex(pixel, palette)]);
      if (denoiseToggle.checked) {
        state.cells = cleanupSpeckles(state.cells, cols, rows);
      }
      drawPattern();
      statusText.textContent = "已生成：" + state.sourceName;
    }

    function drawPattern() {
      const size = Number(beadSize.value);
      const gap = Number(gapSize.value);
      const cols = state.cols;
      const rows = state.rows;
      const width = cols * size + (cols + 1) * gap;
      const height = rows * size + (rows + 1) * gap;
      const ctx = beadCanvas.getContext("2d");

      beadCanvas.width = Math.max(1, width);
      beadCanvas.height = Math.max(1, height);
      ctx.fillStyle = "#fbfdff";
      ctx.fillRect(0, 0, width, height);

      state.cells.forEach((rgb, index) => {
        const x = index % cols;
        const y = Math.floor(index / cols);
        const left = gap + x * (size + gap);
        const top = gap + y * (size + gap);
        drawBead(ctx, left, top, size, rgb);
      });

      updateMetrics();
      updateSwatches();
      drawBoardOverlay();
      syncCanvasView();
      emptyNote.style.display = state.image ? "none" : "block";
    }

    function drawBead(ctx, left, top, size, rgb) {
      const color = rgbToHex(rgb);
      const shade = rgbToHex(rgb.map((value) => value * 0.72));
      const shine = rgbToHex(rgb.map((value) => value + (255 - value) * 0.42));

      if (state.shape === "square") {
        ctx.fillStyle = color;
        ctx.fillRect(left, top, size, size);
        ctx.fillStyle = "rgba(255,255,255,0.24)";
        ctx.fillRect(left + 1, top + 1, Math.max(1, size - 3), Math.max(1, Math.floor(size * 0.32)));
        ctx.strokeStyle = "rgba(0,0,0,0.14)";
        ctx.strokeRect(left + 0.5, top + 0.5, size - 1, size - 1);
        return;
      }

      const radius = size / 2;
      const cx = left + radius;
      const cy = top + radius;
      const gradient = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.12, cx, cy, radius);
      gradient.addColorStop(0, shine);
      gradient.addColorStop(0.38, color);
      gradient.addColorStop(1, shade);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, radius - 0.25), 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, radius * 0.28), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.46)";
      ctx.fill();
    }

    function updateMetrics() {
      const unique = countColors();
      const beads = state.cells.length;
      metrics.size.textContent = state.cols + " x " + state.rows;
      metrics.colors.textContent = unique.length;
      metrics.beads.textContent = beads.toLocaleString("zh-CN");
      metrics.canvas.textContent = beadCanvas.width + " px";
    }

    function countColors() {
      const map = new Map();
      state.cells.forEach((rgb) => {
        const hex = rgbToHex(rgb);
        const current = map.get(hex) || { hex, rgb, count: 0 };
        current.count += 1;
        map.set(hex, current);
      });
      return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }

    function updateSwatches() {
      const colors = countColors();
      const total = state.cells.length;
      swatches.innerHTML = "";

      const summary = document.createElement("div");
      summary.className = "palette-summary";
      summary.innerHTML = `
        <strong>${colors.length} 色 / ${total.toLocaleString("zh-CN")} 颗</strong>
        <span>建议每色多备 5%-10%</span>
      `;
      swatches.appendChild(summary);

      colors.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "swatch";
        row.innerHTML = `
          <span class="chip" style="background:${item.hex}"></span>
          <span class="swatch-name">
            <strong>颜色 ${index + 1}</strong>
            <span>${item.hex.toUpperCase()}</span>
          </span>
          <span class="swatch-counts">
            <strong>${item.count} 颗</strong>
            <span>建议备 ${Math.ceil(item.count * 1.08)} 颗</span>
          </span>
        `;
        swatches.appendChild(row);
      });
    }

    function syncShapeButtons() {
      document.querySelectorAll("[data-shape]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.shape === state.shape);
      });
    }

    

    function loadFile(file) {
      if (!file || !file.type.startsWith("image/")) {
        showToast("请选择一张图片文件");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
      image.onload = () => {
        state.image = image;
        state.sourceName = file.name;
        resetCropControls();
        fileName.textContent = "当前显示：" + file.name;
        generatePattern();
        showToast("照片已经变成拼豆图纸了");
      };
        image.onerror = () => showToast("图片读取失败，换一张试试");
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    }

    function resetCropControls() {
      cropZoom.value = 100;
      cropX.value = 0;
      cropY.value = 0;
      updateCropOutputs();
      renderCropPreview();
    }

    function downloadCanvas() {
      const link = document.createElement("a");
      link.download = "pindou-pattern.png";
      link.href = beadCanvas.toDataURL("image/png");
      link.click();
    }

    function downloadBlob(filename, blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function drawReportLine(ctx, label, value, x, y) {
      ctx.fillStyle = "#667085";
      ctx.font = "28px sans-serif";
      ctx.fillText(label, x, y);
      ctx.fillStyle = "#202431";
      ctx.font = "700 32px sans-serif";
      ctx.fillText(value, x, y + 42);
    }

    function createPageCanvas() {
      const page = document.createElement("canvas");
      page.width = 1240;
      page.height = 1754;
      const ctx = page.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, page.width, page.height);
      return page;
    }

    function drawPageHeader(ctx, title, subtitle) {
      ctx.fillStyle = "#f6fbff";
      ctx.fillRect(0, 0, 1240, 205);
      ctx.fillStyle = "#5279fb";
      ctx.fillRect(70, 62, 8, 92);
      ctx.fillStyle = "#202431";
      ctx.font = "700 48px sans-serif";
      ctx.fillText(title, 105, 105);
      ctx.fillStyle = "#667085";
      ctx.font = "24px sans-serif";
      ctx.fillText(subtitle, 105, 148);
    }

    function drawPageFooter(ctx, pageNumber, totalPages, note) {
      ctx.fillStyle = "#eef5fb";
      ctx.fillRect(0, 1680, 1240, 74);
      ctx.fillStyle = "#667085";
      ctx.font = "22px sans-serif";
      ctx.fillText(note, 70, 1725);
      ctx.textAlign = "right";
      ctx.fillText(`${pageNumber} / ${totalPages}`, 1170, 1725);
      ctx.textAlign = "left";
    }

    function drawOverviewBoardLines(ctx, x, y, scale) {
      const layout = getBoardLayout();
      const unit = Number(beadSize.value) + Number(gapSize.value);
      ctx.save();
      ctx.strokeStyle = "rgba(216, 61, 104, 0.95)";
      ctx.lineWidth = 4;
      for (let column = layout.size; column < state.cols; column += layout.size) {
        const lineX = x + column * unit * scale;
        ctx.beginPath();
        ctx.moveTo(lineX, y);
        ctx.lineTo(lineX, y + beadCanvas.height * scale);
        ctx.stroke();
      }
      for (let row = layout.size; row < state.rows; row += layout.size) {
        const lineY = y + row * unit * scale;
        ctx.beginPath();
        ctx.moveTo(x, lineY);
        ctx.lineTo(x + beadCanvas.width * scale, lineY);
        ctx.stroke();
      }
      ctx.restore();
    }

    function createOverviewReportCanvas(pageNumber, totalPages) {
      const report = createPageCanvas();
      const ctx = report.getContext("2d");
      const colors = countColors();
      const layout = getBoardLayout();
      drawPageHeader(ctx, "拼豆图纸总览", state.sourceName || "");

      drawReportLine(ctx, "图纸尺寸", `${state.cols} x ${state.rows}`, 640, 72);
      drawReportLine(ctx, "颜色", `${colors.length} 色`, 835, 72);
      drawReportLine(ctx, "豆子", `${state.cells.length.toLocaleString("zh-CN")} 颗`, 1000, 72);

      ctx.fillStyle = "#fbfdff";
      ctx.strokeStyle = "#dfe7f0";
      ctx.lineWidth = 3;
      ctx.fillRect(70, 245, 1100, 875);
      ctx.strokeRect(70, 245, 1100, 875);

      const imageScale = Math.min(1020 / beadCanvas.width, 790 / beadCanvas.height);
      const imageWidth = beadCanvas.width * imageScale;
      const imageHeight = beadCanvas.height * imageScale;
      const imageX = (report.width - imageWidth) / 2;
      const imageY = 285 + (790 - imageHeight) / 2;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(beadCanvas, imageX, imageY, imageWidth, imageHeight);
      drawOverviewBoardLines(ctx, imageX, imageY, imageScale);

      ctx.fillStyle = "#202431";
      ctx.font = "700 34px sans-serif";
      ctx.fillText("底板分区", 85, 1190);
      ctx.fillStyle = "#667085";
      ctx.font = "24px sans-serif";
      ctx.fillText(`${layout.size} x ${layout.size} 规格，共 ${layout.columns} x ${layout.rows} = ${layout.total} 块`, 255, 1190);

      const cards = [
        ["1", "先看总览", "确认整张图的方向和底板编号。"],
        ["2", "逐块拼豆", "按照 A1、A2 等分页和坐标制作。"],
        ["3", "核对色表", "每页都有本块用色。"]
      ];
      cards.forEach((item, index) => {
        const x = 70 + index * 370;
        ctx.fillStyle = "#f8fafb";
        ctx.strokeStyle = "#dfe7f0";
        ctx.lineWidth = 2;
        ctx.fillRect(x, 1240, 340, 265);
        ctx.strokeRect(x, 1240, 340, 265);
        ctx.fillStyle = index === 1 ? "#8fb0ff" : "#5279fb";
        ctx.font = "700 30px sans-serif";
        ctx.fillText(item[0], x + 28, 1290);
        ctx.fillStyle = "#202431";
        ctx.font = "700 28px sans-serif";
        ctx.fillText(item[1], x + 28, 1350);
        ctx.fillStyle = "#667085";
        ctx.font = "22px sans-serif";
        ctx.fillText(item[2].slice(0, 14), x + 28, 1405);
        ctx.fillText(item[2].slice(14), x + 28, 1440);
      });

      drawPageFooter(ctx, pageNumber, totalPages, "总览中的红线表示底板边界。");
      return report;
    }

    function getSectionColorCounts(startColumn, endColumn, startRow, endRow) {
      const map = new Map();
      for (let row = startRow; row < endRow; row += 1) {
        for (let column = startColumn; column < endColumn; column += 1) {
          const rgb = state.cells[row * state.cols + column];
          const hex = rgbToHex(rgb);
          const item = map.get(hex) || { hex, count: 0 };
          item.count += 1;
          map.set(hex, item);
        }
      }
      const order = new Map(countColors().map((item, index) => [item.hex, index]));
      return Array.from(map.values()).sort((a, b) => order.get(a.hex) - order.get(b.hex));
    }

    function createBoardReportCanvas(sectionRow, sectionColumn, pageNumber, totalPages) {
      const report = createPageCanvas();
      const ctx = report.getContext("2d");
      const layout = getBoardLayout();
      const startColumn = sectionColumn * layout.size;
      const endColumn = Math.min(state.cols, startColumn + layout.size);
      const startRow = sectionRow * layout.size;
      const endRow = Math.min(state.rows, startRow + layout.size);
      const sectionName = `${String.fromCharCode(65 + sectionRow)}${sectionColumn + 1}`;
      const sectionColors = getSectionColorCounts(startColumn, endColumn, startRow, endRow);
      const globalColors = countColors();
      const colorNumbers = new Map(globalColors.map((item, index) => [item.hex, index + 1]));

      drawPageHeader(
        ctx,
        `底板 ${sectionName}`,
        `列 ${startColumn + 1}-${endColumn}，行 ${startRow + 1}-${endRow} · ${endColumn - startColumn} x ${endRow - startRow} 颗`
      );

      ctx.fillStyle = "#fff7fa";
      ctx.strokeStyle = "#f0c5d2";
      ctx.lineWidth = 2;
      ctx.fillRect(70, 225, 1100, 60);
      ctx.strokeRect(70, 225, 1100, 60);
      ctx.fillStyle = "#9b274a";
      ctx.font = "700 22px sans-serif";
      ctx.fillText("打印时选择“实际大小 / 100%”，每格约 5 mm。", 95, 264);

      const cellSize = report.width * 5 / 210;
      const columns = endColumn - startColumn;
      const rows = endRow - startRow;
      const gridWidth = columns * cellSize;
      const gridHeight = rows * cellSize;
      const gridX = (report.width - gridWidth) / 2;
      const gridY = 335;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 14px sans-serif";
      ctx.fillStyle = "#52606c";
      for (let column = 0; column < columns; column += 1) {
        ctx.fillText(String(startColumn + column + 1), gridX + (column + 0.5) * cellSize, gridY - 18);
      }
      for (let row = 0; row < rows; row += 1) {
        ctx.fillText(String(startRow + row + 1), gridX - 20, gridY + (row + 0.5) * cellSize);
      }

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const rgb = state.cells[(startRow + row) * state.cols + startColumn + column];
          const x = gridX + column * cellSize;
          const y = gridY + row * cellSize;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.fillStyle = rgbToHex(rgb);
          if (state.shape === "round") {
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.42, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
          }
          ctx.strokeStyle = "rgba(50, 60, 70, 0.28)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cellSize, cellSize);
        }
      }
      ctx.strokeStyle = "#5279fb";
      ctx.lineWidth = 4;
      ctx.strokeRect(gridX, gridY, gridWidth, gridHeight);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      const paletteY = gridY + gridHeight + 45;
      ctx.fillStyle = "#202431";
      ctx.font = "700 30px sans-serif";
      ctx.fillText(`本块用色（${sectionColors.length} 色）`, 85, paletteY);
      const columnWidth = 270;
      const rowHeight = 42;
      sectionColors.forEach((item, index) => {
        const column = index % 4;
        const row = Math.floor(index / 4);
        const x = 85 + column * columnWidth;
        const y = paletteY + 28 + row * rowHeight;
        ctx.fillStyle = item.hex;
        ctx.fillRect(x, y, 26, 26);
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.strokeRect(x, y, 26, 26);
        ctx.fillStyle = "#202431";
        ctx.font = "700 18px sans-serif";
        ctx.fillText(`色 ${colorNumbers.get(item.hex)}`, x + 38, y + 20);
        ctx.fillStyle = "#667085";
        ctx.font = "17px sans-serif";
        ctx.fillText(`${item.count} 颗`, x + 118, y + 20);
      });

      drawPageFooter(ctx, pageNumber, totalPages, `底板 ${sectionName} · 坐标使用整张图的行列编号。`);
      return report;
    }

    function createPaletteReportCanvas(pageNumber, totalPages) {
      const report = createPageCanvas();
      const ctx = report.getContext("2d");
      const colors = countColors();
      drawPageHeader(ctx, "完整颜色清单", `${colors.length} 种颜色 · 共 ${state.cells.length.toLocaleString("zh-CN")} 颗`);

      ctx.fillStyle = "#667085";
      ctx.font = "24px sans-serif";
      ctx.fillText("数量为图纸中的准确用量", 80, 255);

      const columns = 2;
      const columnWidth = 530;
      const rowHeight = 88;
      const startX = 80;
      const startY = 305;
      colors.forEach((item, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = startX + column * columnWidth;
        const y = startY + row * rowHeight;
        ctx.fillStyle = "#fbfdff";
        ctx.strokeStyle = "#dfe7f0";
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, columnWidth - 30, 66);
        ctx.strokeRect(x, y, columnWidth - 30, 66);
        ctx.fillStyle = item.hex;
        ctx.fillRect(x + 14, y + 13, 40, 40);
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.strokeRect(x + 14, y + 13, 40, 40);
        ctx.fillStyle = "#202431";
        ctx.font = "700 22px sans-serif";
        ctx.fillText(`颜色 ${index + 1}`, x + 72, y + 30);
        ctx.fillStyle = "#667085";
        ctx.font = "20px sans-serif";
        ctx.fillText(`${item.hex.toUpperCase()} · ${item.count} 颗`, x + 72, y + 54);
      });

      ctx.fillStyle = "#f5f7ff";
      ctx.strokeStyle = "#b9ded7";
      ctx.fillRect(80, 1570, 1030, 70);
      ctx.strokeRect(80, 1570, 1030, 70);
      ctx.fillStyle = "#14766f";
      ctx.font = "700 22px sans-serif";
      ctx.fillText("核对方法：先看颜色编号，再看十六进制色值和颗数。", 105, 1615);
      drawPageFooter(ctx, pageNumber, totalPages, " · 完整色表");
      return report;
    }

    function asciiBytes(text) {
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i += 1) {
        bytes[i] = text.charCodeAt(i) & 0xff;
      }
      return bytes;
    }

    function concatBytes(parts) {
      const total = parts.reduce((sum, part) => sum + part.length, 0);
      const output = new Uint8Array(total);
      let offset = 0;
      parts.forEach((part) => {
        output.set(part, offset);
        offset += part.length;
      });
      return output;
    }

    function dataUrlToBytes(dataUrl) {
      const base64 = dataUrl.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    function buildPdfFromJpegs(images) {
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const objects = [
        asciiBytes("<< /Type /Catalog /Pages 2 0 R >>"),
        asciiBytes(`<< /Type /Pages /Kids [${images.map((_, index) => `${3 + index * 3} 0 R`).join(" ")}] /Count ${images.length} >>`)
      ];

      images.forEach((image, index) => {
        const pageObject = 3 + index * 3;
        const contentObject = pageObject + 1;
        const imageObject = pageObject + 2;
        const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ`;
        objects.push(
          asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`),
          asciiBytes(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
          concatBytes([
            asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),
            image.bytes,
            asciiBytes("\nendstream")
          ])
        );
      });

      const parts = [asciiBytes("%PDF-1.4\n")];
      const offsets = [];
      let position = parts[0].length;

      objects.forEach((object, index) => {
        offsets.push(position);
        const chunk = concatBytes([
          asciiBytes(`${index + 1} 0 obj\n`),
          object,
          asciiBytes("\nendobj\n")
        ]);
        parts.push(chunk);
        position += chunk.length;
      });

      const xrefPosition = position;
      let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
      offsets.forEach((offset) => {
        xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
      });
      xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;
      parts.push(asciiBytes(xref));
      return concatBytes(parts);
    }

    function createEnhancedPdfImages() {
      const layout = getBoardLayout();
      const totalPages = layout.total + 2;
      const images = [];
      const addPage = (canvas) => {
        images.push({
          bytes: dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.93)),
          width: canvas.width,
          height: canvas.height
        });
      };

      addPage(createOverviewReportCanvas(1, totalPages));
      let pageNumber = 2;
      for (let row = 0; row < layout.rows; row += 1) {
        for (let column = 0; column < layout.columns; column += 1) {
          addPage(createBoardReportCanvas(row, column, pageNumber, totalPages));
          pageNumber += 1;
        }
      }
      addPage(createPaletteReportCanvas(totalPages, totalPages));
      return images;
    }

    function buildEnhancedPdfBytes() {
      return buildPdfFromJpegs(createEnhancedPdfImages());
    }

    async function downloadPdf() {
      const button = document.getElementById("downloadPdfBtn");
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "正在生成...";
      try {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        const pdfBytes = buildEnhancedPdfBytes();
        downloadBlob("pindou-pattern.pdf", new Blob([pdfBytes], { type: "application/pdf" }));
        showToast(`PDF 已生成，共 ${getBoardLayout().total + 2} 页`);
      } catch (error) {
        showToast("PDF 生成失败");
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }

    async function copyPalette() {
      const colors = countColors();
      const total = state.cells.length;
      const lines = [
        "颜色清单",
        `图纸尺寸：${state.cols} x ${state.rows}`,
        `预计豆子：${total.toLocaleString("zh-CN")} 颗`,
        `使用颜色：${colors.length} 色`,
        "建议：每种颜色多备 5%-10%，避免拼到一半缺豆。",
        "",
        ...colors.map((item, index) => `颜色 ${index + 1}: ${item.hex.toUpperCase()} / 原图 ${item.count} 颗 / 建议备 ${Math.ceil(item.count * 1.08)} 颗`)
      ];
      const text = lines.join("\n");

      try {
        await navigator.clipboard.writeText(text);
        showToast("复制成功");
      } catch (error) {
        showToast("浏览器不允许复制，可以手动看右侧色表");
      }
    }

    function resetSettings() {
      beadWidth.value = 72;
      colorCount.value = 28;
      beadSize.value = 8;
      gapSize.value = 0;
      colorStyle.value = "natural";
      denoiseToggle.checked = false;
      boardToggle.checked = false;
      boardSize.value = 29;
      resetCropControls();
      state.shape = "square";
      viewState.userAdjusted = false;
      syncShapeButtons();
      generatePattern();
      showToast("已恢复默认设置");
    }

    [beadWidth, colorCount, beadSize, gapSize, colorStyle, cropZoom, cropX, cropY].forEach((control) => {
      control.addEventListener("input", generatePattern);
      control.addEventListener("change", generatePattern);
    });

    denoiseToggle.addEventListener("change", generatePattern);
    boardToggle.addEventListener("change", drawBoardOverlay);
    boardSize.addEventListener("change", drawBoardOverlay);

    document.getElementById("zoomOutBtn").addEventListener("click", () => {
      setCanvasZoom(viewState.zoom - 0.15);
    });

    document.getElementById("zoomInBtn").addEventListener("click", () => {
      setCanvasZoom(viewState.zoom + 0.15);
    });

    document.getElementById("fitCanvasBtn").addEventListener("click", fitCanvas);

    canvasStage.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.pointerType === "touch" || !canvasViewport.classList.contains("is-pannable")) return;
      viewState.dragging = true;
      viewState.pointerId = event.pointerId;
      viewState.startX = event.clientX;
      viewState.startY = event.clientY;
      viewState.startScrollLeft = canvasViewport.scrollLeft;
      viewState.startScrollTop = canvasViewport.scrollTop;
      canvasStage.setPointerCapture(event.pointerId);
      canvasViewport.classList.add("is-dragging");
      event.preventDefault();
    });

    canvasStage.addEventListener("pointermove", (event) => {
      if (!viewState.dragging || event.pointerId !== viewState.pointerId) return;
      canvasViewport.scrollLeft = viewState.startScrollLeft - (event.clientX - viewState.startX);
      canvasViewport.scrollTop = viewState.startScrollTop - (event.clientY - viewState.startY);
    });

    function stopCanvasDrag(event) {
      if (!viewState.dragging || event.pointerId !== viewState.pointerId) return;
      viewState.dragging = false;
      viewState.pointerId = null;
      canvasViewport.classList.remove("is-dragging");
    }

    canvasStage.addEventListener("pointerup", stopCanvasDrag);
    canvasStage.addEventListener("pointercancel", stopCanvasDrag);
    window.addEventListener("resize", () => {
      if (viewState.userAdjusted) {
        applyCanvasZoom(false);
      } else {
        fitCanvas();
      }
    });

    document.querySelectorAll("[data-shape]").forEach((button) => {
      button.addEventListener("click", () => {
        state.shape = button.dataset.shape;
        syncShapeButtons();
        drawPattern();
      });
    });

    imageInput.addEventListener("change", (event) => {
      loadFile(event.target.files[0]);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add("is-dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove("is-dragging");
      });
    });

    dropZone.addEventListener("drop", (event) => {
      loadFile(event.dataTransfer.files[0]);
    });

    document.getElementById("downloadBtn").addEventListener("click", downloadCanvas);
    document.getElementById("downloadPdfBtn").addEventListener("click", downloadPdf);
    document.getElementById("copyPaletteBtn").addEventListener("click", copyPalette);
    document.getElementById("resetBtn").addEventListener("click", resetSettings);

    ["copy", "cut", "dragstart"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        event.preventDefault();
      });
    });

    generatePattern();

    /* ================= 离线支持：首次访问缓存全部资源 ================= */
    if ("serviceWorker" in navigator && window.isSecureContext) {
      const offlineNoticeKey = "pindou-offline-notice";

      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").then((registration) => {
          if (navigator.serviceWorker.controller && !window.localStorage.getItem(offlineNoticeKey)) {
            showToast("已缓存到本地，之后断网也能使用");
            window.localStorage.setItem(offlineNoticeKey, "1");
          }

          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                showToast("已有新版本，刷新页面即可更新");
              }
            });
          });
        }).catch((error) => {
          console.warn("[app] Service Worker 注册失败：", error);
        });
      });

      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    }
