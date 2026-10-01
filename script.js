// Global State Variables
let currentOriginalBinary = "";
let currentCRC = "";
let transmittedBits = []; // Array of bit objects: { val: '0'/'1', isError: bool, isCRC: bool }
let currentPoly = "1101";

// Tab Switching Handler
function switchTab(tabName) {
  const simSec = document.getElementById('section-simulation');
  const theorySec = document.getElementById('section-theory');
  const simBtn = document.getElementById('tab-sim-btn');
  const theoryBtn = document.getElementById('tab-theory-btn');

  if (tabName === 'simulation') {
    simSec.classList.remove('hidden');
    theorySec.classList.add('hidden');
    simBtn.className = "px-4 py-1.5 rounded-md font-medium transition text-white bg-indigo-600";
    theoryBtn.className = "px-4 py-1.5 rounded-md font-medium text-slate-400 hover:text-slate-200 transition";
  } else {
    simSec.classList.add('hidden');
    theorySec.classList.remove('hidden');
    theoryBtn.className = "px-4 py-1.5 rounded-md font-medium transition text-white bg-indigo-600";
    simBtn.className = "px-4 py-1.5 rounded-md font-medium text-slate-400 hover:text-slate-200 transition";
  }
}

// Convert ASCII Text Message to Binary
function textToBinary(text) {
  return text.split('')
    .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
}

// Convert Binary back to ASCII Text
function binaryToText(binaryStr) {
  let text = "";
  for (let i = 0; i < binaryStr.length; i += 8) {
    const byte = binaryStr.substr(i, 8);
    if (byte.length === 8) {
      text += String.fromCharCode(parseInt(byte, 2));
    }
  }
  return text;
}

// Modulo-2 Division (XOR) Logic
function modulo2Divide(dividend, divisor, recordTrace = false) {
  let trace = [];
  let pick = divisor.length;
  let tmp = dividend.substring(0, pick);
  const n = dividend.length;

  if (recordTrace) {
    trace.push(`Dividing Frame: ${dividend}`);
    trace.push(`Generator Polynomial: ${divisor}\n`);
  }

  while (pick < n) {
    if (tmp[0] === '1') {
      let xorRes = "";
      for (let j = 0; j < divisor.length; j++) {
        xorRes += (tmp[j] === divisor[j]) ? '0' : '1';
      }
      if (recordTrace) trace.push(`  ${tmp}\n⊕ ${divisor}\n  ${'-'.repeat(divisor.length)}\n  ${xorRes}`);
      tmp = xorRes.substring(1) + dividend[pick];
    } else {
      let zeroDiv = "0".repeat(divisor.length);
      let xorRes = "";
      for (let j = 0; j < divisor.length; j++) {
        xorRes += (tmp[j] === zeroDiv[j]) ? '0' : '1';
      }
      tmp = xorRes.substring(1) + dividend[pick];
    }
    pick++;
  }

  // Last step bit XOR
  if (tmp[0] === '1') {
    let xorRes = "";
    for (let j = 0; j < divisor.length; j++) {
      xorRes += (tmp[j] === divisor[j]) ? '0' : '1';
    }
    if (recordTrace) trace.push(`  ${tmp}\n⊕ ${divisor}\n  ${'-'.repeat(divisor.length)}\n  ${xorRes}`);
    tmp = xorRes.substring(1);
  } else {
    tmp = tmp.substring(1);
  }

  return { remainder: tmp, trace: trace };
}

// Handle Polynomial Dropdown Change
function onPolySelectChange() {
  const select = document.getElementById('polySelect');
  const polyInput = document.getElementById('polyInput');

  if (select.value !== 'custom') {
    polyInput.value = select.value;
  }
  runCRCPipeline();
}

// Handle Message Input Change
function processMessageInput() {
  const text = document.getElementById('msgInput').value || "A";
  currentOriginalBinary = textToBinary(text);
  document.getElementById('binaryMsgDisplay').innerText = currentOriginalBinary;
  runCRCPipeline();
}

// Main Pipeline Workflow
function runCRCPipeline() {
  const poly = document.getElementById('polyInput').value.trim();
  if (!poly || !/^[01]+$/.test(poly) || poly.length < 2) {
    return;
  }
  currentPoly = poly;

  // Step 1: Calculate CRC at Sender
  const zerosToAppend = "0".repeat(poly.length - 1);
  const paddedData = currentOriginalBinary + zerosToAppend;
  const senderResult = modulo2Divide(paddedData, poly);
  currentCRC = senderResult.remainder;

  // Construct Channel Transmitted Bits
  const fullFrame = currentOriginalBinary + currentCRC;
  transmittedBits = fullFrame.split('').map((bit, index) => ({
    val: bit,
    isError: false,
    isCRC: index >= currentOriginalBinary.length
  }));

  renderChannelBits();
  verifyReceiver();
}

// Render Channel Bits in UI
function renderChannelBits() {
  const container = document.getElementById('channelBitDisplay');
  container.innerHTML = "";

  transmittedBits.forEach((bitObj, idx) => {
    const btn = document.createElement('button');
    btn.onclick = () => toggleBitError(idx);
    btn.title = `Click to toggle bit at position ${idx}`;

    let classes = "bit-box w-7 h-8 text-xs font-mono font-bold rounded flex items-center justify-center cursor-pointer border shadow-sm ";

    if (bitObj.isError) {
      classes += "bg-rose-600 border-rose-400 text-white animate-pulse";
    } else if (bitObj.isCRC) {
      classes += "bg-indigo-950 border-indigo-500 text-indigo-300";
    } else {
      classes += "bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500";
    }

    btn.className = classes;
    btn.innerText = bitObj.val;
    container.appendChild(btn);
  });
}

// Toggle Bit Error manually on user click
function toggleBitError(index) {
  transmittedBits[index].val = transmittedBits[index].val === '0' ? '1' : '0';
  transmittedBits[index].isError = !transmittedBits[index].isError;
  renderChannelBits();
  verifyReceiver();
}

// Inject Single Error
function injectSingleError() {
  if (transmittedBits.length === 0) return;
  const randomIndex = Math.floor(Math.random() * transmittedBits.length);
  toggleBitError(randomIndex);
}

// Inject Burst Error
function injectBurstError() {
  if (transmittedBits.length < 3) return;
  const burstLength = Math.min(3, transmittedBits.length);
  const startIndex = Math.floor(Math.random() * (transmittedBits.length - burstLength));

  for (let i = startIndex; i < startIndex + burstLength; i++) {
    transmittedBits[i].val = transmittedBits[i].val === '0' ? '1' : '0';
    transmittedBits[i].isError = !transmittedBits[i].isError;
  }
  renderChannelBits();
  verifyReceiver();
}

// Reset Noise / Errors
function clearNoise() {
  runCRCPipeline();
}

// Receiver Validation & Trace Execution
function verifyReceiver() {
  const receivedFrame = transmittedBits.map(b => b.val).join('');
  const receiverResult = modulo2Divide(receivedFrame, currentPoly, true);
  
  const remainder = receiverResult.remainder;
  const isZeroRemainder = /^0+$/.test(remainder);

  document.getElementById('remainderDisplay').innerText = remainder;

  // Decode Message Bits
  const msgLength = transmittedBits.length - (currentPoly.length - 1);
  const receivedMsgBits = receivedFrame.substring(0, msgLength);
  const decodedText = binaryToText(receivedMsgBits);
  document.getElementById('decodedTextDisplay').innerText = decodedText || "[Corrupted]";

  // Update Visual Trace Box
  const traceBox = document.getElementById('xorTraceBox');
  traceBox.innerText = receiverResult.trace.join('\n');

  // Update Banner UI
  const banner = document.getElementById('statusBanner');
  const title = document.getElementById('statusTitle');
  const desc = document.getElementById('statusDesc');
  const icon = document.getElementById('statusIcon');

  if (isZeroRemainder) {
    banner.className = "p-4 rounded-xl border flex items-center gap-3 transition-all duration-300 bg-emerald-950/60 border-emerald-500/40 text-emerald-200";
    title.innerText = "Message Integrity Intact";
    desc.innerText = "Modulo-2 division remainder is 0. No noise/errors detected in transmission.";
    icon.innerHTML = `<svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  } else {
    banner.className = "p-4 rounded-xl border flex items-center gap-3 transition-all duration-300 bg-rose-950/60 border-rose-500/40 text-rose-200";
    title.innerText = "Transmission Error Detected!";
    desc.innerText = `Non-zero remainder (${remainder}). Classroom message was corrupted during transmission and rejected.`;
    icon.innerHTML = `<svg class="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  }
}

// Initial Run on Page Load
window.onload = () => {
  processMessageInput();
};