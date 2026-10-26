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

export function renderTimerUI(ctx, node, timerMs, displayText, activeColor, isCompleted = false) {
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
    const rectH = Math.max(80, nodeH - headerOffset - margin);
    
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.fillRect(margin, headerOffset, rectW, rectH);
    ctx.strokeStyle = "#222222";
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, headerOffset, rectW, rectH);

    const scale = Math.max(0.5, Math.min(rectW / 240, rectH / 90));
    const centerY = headerOffset + rectH * 0.42;
    
    const totalSec = Math.floor(Math.max(0, timerMs) / 1000);
    const timeStr = `${String(Math.floor(totalSec/3600)).padStart(2,'0')}:${String(Math.floor((totalSec%3600)/60)).padStart(2,'0')}:${String(totalSec%60).padStart(2,'0')}`;

    ctx.fillStyle = "#666666";
    ctx.font = `bold ${Math.max(9, Math.round(10 * scale))}px monospace`;
    ctx.textAlign = "center";
    const digitHeight = 26 * scale;
    const digitStartY = centerY - (digitHeight / 2);
    ctx.fillText("TOTAL ELAPSED", nodeW / 2, digitStartY - 8 * scale);

    const digitWidth = 14 * scale;
    const digitGap = 5 * scale;
    const colonWidth = 8 * scale;
    const totalDisplayWidth = (6 * digitWidth) + (7 * digitGap) + (2 * colonWidth);
    let startX = (nodeW - totalDisplayWidth) / 2;

    const inactiveColor = INACTIVE_COLOR_MAP[activeColor] || "#1A1A1A";
    
    node._hitDigit = { x: startX - 4, y: digitStartY - 4, w: totalDisplayWidth + 8, h: digitHeight + 8 };

    for (let i = 0; i < timeStr.length; i++) {
        const char = timeStr[i];
        if (char === ':') {
            const dotSize = Math.max(3, colonWidth * 0.35);
            const cx = startX + colonWidth / 2 - dotSize / 2;
            
            ctx.fillStyle = activeColor;
            ctx.globalAlpha = 0.2;
            ctx.fillRect(cx - 0.5, digitStartY + digitHeight * 0.3 - dotSize / 2 - 0.5, dotSize + 1, dotSize + 1);
            ctx.fillRect(cx - 0.5, digitStartY + digitHeight * 0.7 - dotSize / 2 - 0.5, dotSize + 1, dotSize + 1);
            
            ctx.globalAlpha = 1.0;
            ctx.fillRect(cx, digitStartY + digitHeight * 0.3 - dotSize / 2, dotSize, dotSize);
            ctx.fillRect(cx, digitStartY + digitHeight * 0.7 - dotSize / 2, dotSize, dotSize);
            
            startX += colonWidth + digitGap;
        } else {
            drawDigit(ctx, startX, digitStartY, digitWidth, digitHeight, char, activeColor, inactiveColor);
            startX += digitWidth + digitGap;
        }
    }

    const swatchSize = Math.max(5, Math.round(6 * scale));
    const swatchGap = 6 * scale;
    const totalSwatchesW = COLOR_PALETTE.length * swatchSize + (COLOR_PALETTE.length - 1) * swatchGap;
    let swatchStartX = (nodeW - totalSwatchesW) / 2;
    const swatchY = digitStartY + digitHeight + 6 * scale;

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

    const statusFontSize = Math.max(10, Math.round(11 * scale));
    const statusY = swatchY + swatchSize + 14 * scale;
    ctx.font = `bold ${statusFontSize}px monospace`;
    
    const bracketW = ctx.measureText("[").width;
    const innerW = ctx.measureText(` ${displayText} `).width;
    let textX = (nodeW - (bracketW * 2 + innerW)) / 2;

    ctx.fillStyle = "#666666";
    ctx.textAlign = "left";
    ctx.fillText("[", textX, statusY);
    textX += bracketW;

    let textColor = "#00B5F1"; 
    if (displayText === "READY") textColor = "#B0BEC5";
    else if (displayText === "INTERRUPT") textColor = "#DEB200";
    else if (displayText === "ERROR") textColor = "#E60373";
    else if (isCompleted) textColor = "#00DF77";

    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.2;
    ctx.fillText(` ${displayText} `, textX, statusY);
    ctx.globalAlpha = 1.0;
    ctx.fillText(` ${displayText} `, textX, statusY);
    
    textX += innerW;

    ctx.fillStyle = "#666666";
    ctx.fillText("]", textX, statusY);

    ctx.restore();
}

function drawDigit(ctx, x, y, width, height, char, activeColor, inactiveColor) {
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
            ctx.globalAlpha = 0.15;
            ctx.fillRect(segs[i].x - 1, segs[i].y - 1, segs[i].w + 2, segs[i].h + 2);
            
            ctx.globalAlpha = 1.0;
            ctx.fillRect(segs[i].x, segs[i].y, segs[i].w, segs[i].h);
        } else {
            ctx.fillStyle = inactiveColor;
            ctx.fillRect(segs[i].x, segs[i].y, segs[i].w, segs[i].h);
        }
    }
}