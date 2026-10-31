/**
 * ComfyUI-Batch-Image-Timer
 * A specialized 7-segment LED timer for tracking the total execution time of batch image processing workflows.
 * 
 * @version 0.2.3
 * @copyright Copyright (c) 2026 Herman Kwan
 * @license MIT
 */

const COLOR_PALETTE = ["#FFFFFF", "#00BFFF", "#00FF88", "#FFCC00", "#FF007F"];
const INACTIVE_COLOR_MAP = {
    "#FFFFFF": "#1A1A1A", "#00BFFF": "#001A22", "#00FF88": "#001F11",
    "#FFCC00": "#1F1700", "#FF007F": "#1F0010"
};
const SEGMENT_MAP = {
    '0': [1,1,1,1,1,1,0], '1': [0,1,1,0,0,0,0], '2': [1,1,0,1,1,0,1],
    '3': [1,1,1,1,0,0,1], '4': [0,1,1,0,0,1,1], '5': [1,0,1,1,0,1,1],
    '6': [1,0,1,1,1,1,1], '7': [1,1,1,0,0,0,0], '8': [1,1,1,1,1,1,1],
    '9': [1,1,1,1,0,1,1]
};

export function renderTimerUI(ctx, node, timerMs, displayText, activeColor, isCompleted, displayMode, progressStatus, flashTime = 0) {
    const nodeW = node.size[0];
    const nodeH = node.size[1];
    
    let headerOffset = 30;
    if (node.widgets && node.widgets.length > 0) {
        let maxY = 0;
        for (const w of node.widgets) {
            if (w.last_y !== undefined && w.type !== "hidden_seq_index") {
                const h = (typeof w.computeSize === "function") ? w.computeSize()[1] : 20;
                const bottom = w.last_y + h;
                if (bottom > maxY) maxY = bottom;
            }
        }
        headerOffset = maxY > 0 ? maxY + 15 : 65;
    }

    const margin = 10;
    const rectW = nodeW - margin * 2;
    let rawH = nodeH - headerOffset - margin;
    if (isNaN(rawH)) rawH = 100;
    const rectH = Math.max(80, rawH);
    
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.fillRect(margin, headerOffset, rectW, rectH);
    ctx.strokeStyle = "#222222";
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, headerOffset, rectW, rectH);

    const scale = Math.max(0.5, Math.min(rectW / 240, rectH / 90));
    const centerY = headerOffset + rectH * 0.46;

    let timeStr;
    if (timerMs === (99 * 3600 + 99 * 60 + 99) * 1000) {
        timeStr = "99:99:99";
    } else {
        const totalSec = Math.floor(Math.max(0, timerMs) / 1000);
        timeStr = `${String(Math.floor(totalSec/3600)).padStart(2,'0')}:${String(Math.floor((totalSec%3600)/60)).padStart(2,'0')}:${String(totalSec%60).padStart(2,'0')}`;
    }

    const digitHeight = 26 * scale;
    const digitStartY = centerY - (digitHeight / 2);

    drawModeTabs(ctx, node, nodeW, digitStartY, scale, displayMode);

    const digitWidth = 14 * scale;
    const digitGap = 5 * scale;
    const colonWidth = 8 * scale;
    const totalDisplayWidth = (6 * digitWidth) + (7 * digitGap) + (2 * colonWidth);
    let startX = (nodeW - totalDisplayWidth) / 2;

    const inactiveColor = INACTIVE_COLOR_MAP[activeColor] || "#1A1A1A";
    node._hitDigit = { x: startX - 4, y: digitStartY - 4, w: totalDisplayWidth + 8, h: digitHeight + 8 };

    const isFlashing = (Date.now() - flashTime < 150);

    for (let i = 0; i < timeStr.length; i++) {
        const char = timeStr[i];
        if (char === ':') {
            const dotSize = Math.max(3, colonWidth * 0.35);
            const cx = startX + colonWidth / 2 - dotSize / 2;
            
            ctx.fillStyle = activeColor;
            ctx.globalAlpha = isFlashing ? 0.05 : 0.3;
            ctx.fillRect(cx - 0.5, digitStartY + digitHeight * 0.3 - dotSize / 2 - 0.5, dotSize + 1, dotSize + 1);
            ctx.fillRect(cx - 0.5, digitStartY + digitHeight * 0.7 - dotSize / 2 - 0.5, dotSize + 1, dotSize + 1);
            
            ctx.globalAlpha = isFlashing ? 0.2 : 1.0;
            ctx.fillRect(cx, digitStartY + digitHeight * 0.3 - dotSize / 2, dotSize, dotSize);
            ctx.fillRect(cx, digitStartY + digitHeight * 0.7 - dotSize / 2, dotSize, dotSize);
            
            startX += colonWidth + digitGap;
        } else {
            drawDigit(ctx, startX, digitStartY, digitWidth, digitHeight, char, activeColor, inactiveColor, isFlashing);
            startX += digitWidth + digitGap;
        }
    }

    ctx.globalAlpha = 1.0;

    const swatchSize = Math.max(5, Math.round(6 * scale));
    const swatchGap = 6 * scale;
    const totalSwatchesW = COLOR_PALETTE.length * swatchSize + (COLOR_PALETTE.length - 1) * swatchGap;
    let swatchStartX = (nodeW - totalSwatchesW) / 2;
    const swatchY = digitStartY + digitHeight + 10 * scale; 

    node._hitSwatches = [];
    COLOR_PALETTE.forEach(color => {
        ctx.fillStyle = color;
        ctx.fillRect(swatchStartX, swatchY, swatchSize, swatchSize);
        if (color === activeColor) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 1;
            ctx.strokeRect(swatchStartX - 1.5, swatchY - 1.5, swatchSize + 3, swatchSize + 3);
        }
        node._hitSwatches.push({ x: swatchStartX - 3, y: swatchY - 3, w: swatchSize + 6, h: swatchSize + 6, color });
        swatchStartX += swatchSize + swatchGap;
    });

    const statusY = swatchY + swatchSize + 14 * scale;
    drawCounter(ctx, node, nodeW, statusY, scale, displayText, progressStatus, isCompleted);

    ctx.restore();
}

function drawModeTabs(ctx, node, nodeW, digitStartY, scale, displayMode) {
    const modes = ["ETA", "COMPUTE", "TOTAL"];
    const separators = [" | ", " | "];
    const textToMeasure = [];
    
    modes.forEach((mode, i) => {
        textToMeasure.push(mode);
        if (i < modes.length - 1) textToMeasure.push(separators[i]);
    });

    const titleFontSize = Math.max(9, Math.round(10 * scale));
    ctx.font = `bold ${titleFontSize}px monospace`;
    ctx.textAlign = "center";

    const widths = textToMeasure.map(t => ctx.measureText(t).width);
    const totalTitleWidth = widths.reduce((a, b) => a + b, 0);
    
    let titleX = (nodeW - totalTitleWidth) / 2;
    const titleY = digitStartY - 14 * scale;

    node._hitTabs = [];

    let currentX = titleX;
    for (let i = 0; i < modes.length; i++) {
        const mode = modes[i];
        const w = ctx.measureText(mode).width;

        ctx.fillStyle = (displayMode === mode) ? "#00BFFF" : "#555555";
        ctx.fillText(mode, currentX + w / 2, titleY);
        
        node._hitTabs.push({
            x: currentX,
            y: titleY - titleFontSize,
            w: w,
            h: titleFontSize + 4,
            mode: mode
        });

        currentX += w;

        if (i < modes.length - 1) {
            ctx.fillStyle = "#333333"; 
            const sep = separators[i];
            const sepW = ctx.measureText(sep).width;
            ctx.fillText(sep, currentX + sepW / 2, titleY);
            currentX += sepW;
        }
    }
}

function drawCounter(ctx, node, nodeW, statusY, scale, displayText, progressStatus, isCompleted) {
    const statusFontSize = Math.max(10, Math.round(11 * scale));
    ctx.font = `bold ${statusFontSize}px monospace`;
    
    const bracketW = ctx.measureText("[").width;
    const innerW = ctx.measureText(` ${displayText} `).width;
    let textX = (nodeW - (bracketW * 2 + innerW)) / 2;

    ctx.fillStyle = "#666666";
    ctx.textAlign = "left";
    ctx.fillText("[", textX, statusY);
    textX += bracketW;

    let textColor = "#00BFFF"; 
    if (displayText === "READY") textColor = "#B0BEC5";
    else if (progressStatus === "INTERRUPT") textColor = "#FFCC00"; 
    else if (progressStatus === "ERROR") textColor = "#FF3333"; 
    else if (isCompleted) textColor = "#00FF88"; 

    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.2;
    ctx.fillText(` ${displayText} `, textX, statusY);
    ctx.globalAlpha = 1.0;
    ctx.fillText(` ${displayText} `, textX, statusY);
    
    textX += innerW;

    ctx.fillStyle = "#666666";
    ctx.fillText("]", textX, statusY);
}

function drawDigit(ctx, x, y, width, height, char, activeColor, inactiveColor, isFlashing) {
    const segments = SEGMENT_MAP[char] || [0,0,0,0,0,0,0];
    const t = Math.max(2, width * 0.14);
    const gap = width * 0.08;
    const hH = height / 2;
    
    const segs = [
        { x: x + t + gap, y: y, w: width - 2 * t - 2 * gap, h: t },
        { x: x + width - t, y: y + t + gap, w: t, h: hH - t - 2 * gap },
        { x: x + width - t, y: y + hH + gap, w: t, h: hH - t - 2 * gap },
        { x: x + t + gap, y: y + height - t, w: width - 2 * t - 2 * gap, h: t },
        { x: x, y: y + hH + gap, w: t, h: hH - t - 2 * gap },
        { x: x, y: y + t + gap, w: t, h: hH - t - 2 * gap },
        { x: x + t + gap, y: y + hH - t / 2, w: width - 2 * t - 2 * gap, h: t }
    ];

    for (let i = 0; i < 7; i++) {
        if (segments[i]) {
            ctx.fillStyle = activeColor;
            ctx.globalAlpha = isFlashing ? 0.05 : 0.3;
            ctx.fillRect(segs[i].x - 1, segs[i].y - 1, segs[i].w + 2, segs[i].h + 2);
            
            ctx.globalAlpha = isFlashing ? 0.2 : 1.0;
            ctx.fillRect(segs[i].x, segs[i].y, segs[i].w, segs[i].h);
        } else {
            ctx.fillStyle = inactiveColor;
            ctx.globalAlpha = 0.5; 
            ctx.fillRect(segs[i].x - 1, segs[i].y - 1, segs[i].w + 2, segs[i].h + 2);
            
            ctx.globalAlpha = 1.0;
            ctx.fillRect(segs[i].x, segs[i].y, segs[i].w, segs[i].h);
        }
    }
}