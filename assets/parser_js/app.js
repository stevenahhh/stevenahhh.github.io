const MIN_PANEL_HEIGHT = 96;
const FRAME_ID = 'parser-js-frame';
const sourceInput = document.getElementById('source-input');
const renderedView = document.getElementById('rendered-view');
const stepsTableView = document.getElementById('steps-table-view');
let updateTimer = null;
let resizeFrame = null;

const initialText = [
    'This is a plain text sentence.',
    'This sentence uses *italic* emphasis.',
    'This sentence uses **bold** emphasis.',
    'This sentence uses nested **bold *italic* bold** formatting.',
    'This sentence uses ***triple*** markers.',
    '이 문장은 *이탤릭* 강조를 사용합니다.'
].join('\n');

class Stack {
    constructor() {
        this.data = [];
    }

    push(item) {
        this.data.push(item);
    }

    pop() {
        if (this.isEmpty()) {
            throw new Error('pop from empty Stack');
        }
        return this.data.pop();
    }

    peek() {
        if (this.isEmpty()) {
            throw new Error('peek from empty Stack');
        }
        return this.data[this.data.length - 1];
    }

    isEmpty() {
        return this.data.length === 0;
    }

    toList() {
        return [...this.data];
    }
}

class Queue {
    constructor() {
        this.data = [];
    }

    enqueue(item) {
        this.data.push(item);
    }

    dequeue() {
        if (this.isEmpty()) {
            throw new Error('dequeue from empty Queue');
        }
        return this.data.shift();
    }

    isEmpty() {
        return this.data.length === 0;
    }

    toList() {
        return [...this.data];
    }
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function queueSnapshot(queue) {
    return queue.toList().map((token) => [...token]);
}

function stackSnapshot(stack) {
    return stack.toList();
}

function makeStep(stepNumber, phase, action, token, queue, stack, output) {
    return {
        step: stepNumber,
        phase,
        action,
        token: [...token],
        queue: queueSnapshot(queue),
        stack: stackSnapshot(stack),
        output,
    };
}

function tokenizeWithSteps(text) {
    const tokens = new Queue();
    const steps = [];
    let index = 0;
    let stepNumber = 1;

    while (index < text.length) {
        if (text[index] === '*') {
            const start = index;
            while (index < text.length && text[index] === '*') {
                index += 1;
            }

            let markerCount = index - start;
            const nextChar = index < text.length ? text[index] : '';
            const isClosingTriple = (
                markerCount === 3 &&
                start > 0 &&
                text[start - 1] !== '*' &&
                (nextChar === '' || (!/[A-Za-z0-9]/.test(nextChar) && nextChar !== '_'))
            );

            if (isClosingTriple) {
                tokens.enqueue(['MARKER', '*']);
                steps.push(makeStep(stepNumber, 'tokenize', 'enqueue', ['MARKER', '*'], tokens, new Stack(), ''));
                stepNumber += 1;
                tokens.enqueue(['MARKER', '**']);
                steps.push(makeStep(stepNumber, 'tokenize', 'enqueue', ['MARKER', '**'], tokens, new Stack(), ''));
                stepNumber += 1;
            } else {
                while (markerCount >= 2) {
                    tokens.enqueue(['MARKER', '**']);
                    steps.push(makeStep(stepNumber, 'tokenize', 'enqueue', ['MARKER', '**'], tokens, new Stack(), ''));
                    stepNumber += 1;
                    markerCount -= 2;
                }
                if (markerCount === 1) {
                    tokens.enqueue(['MARKER', '*']);
                    steps.push(makeStep(stepNumber, 'tokenize', 'enqueue', ['MARKER', '*'], tokens, new Stack(), ''));
                    stepNumber += 1;
                }
            }
        } else {
            const start = index;
            while (index < text.length && text[index] !== '*') {
                index += 1;
            }
            const token = ['TEXT', text.slice(start, index)];
            tokens.enqueue(token);
            steps.push(makeStep(stepNumber, 'tokenize', 'enqueue', token, tokens, new Stack(), ''));
            stepNumber += 1;
        }
    }

    return { tokens, steps };
}

function escapeParserHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function openingTag(marker) {
    return marker === '**' ? '<strong>' : '<em>';
}

function closingTag(marker) {
    return marker === '**' ? '</strong>' : '</em>';
}

function parseMarkdownWithSteps(text) {
    const tokenizeResult = tokenizeWithSteps(text);
    const queue = tokenizeResult.tokens;
    const tokenizeSteps = tokenizeResult.steps;
    const stack = new Stack();
    const output = [];
    const parseSteps = [];
    let stepNumber = tokenizeSteps.length + 1;

    while (!queue.isEmpty()) {
        const currentToken = queue.dequeue();
        const tokenType = currentToken[0];
        const tokenValue = currentToken[1];

        if (tokenType === 'TEXT') {
            output.push(escapeParserHtml(tokenValue));
            parseSteps.push(makeStep(stepNumber, 'parse', 'dequeue', currentToken, queue, stack, output.join('')));
            stepNumber += 1;
        } else if (!stack.isEmpty() && stack.peek() === tokenValue) {
            stack.pop();
            output.push(closingTag(tokenValue));
            parseSteps.push(makeStep(stepNumber, 'parse', 'pop', currentToken, queue, stack, output.join('')));
            stepNumber += 1;
        } else {
            stack.push(tokenValue);
            output.push(openingTag(tokenValue));
            parseSteps.push(makeStep(stepNumber, 'parse', 'push', currentToken, queue, stack, output.join('')));
            stepNumber += 1;
        }
    }

    while (!stack.isEmpty()) {
        const marker = stack.pop();
        output.push(closingTag(marker));
        parseSteps.push(makeStep(stepNumber, 'parse', 'pop', ['MARKER', marker], queue, stack, output.join('')));
        stepNumber += 1;
    }

    const allSteps = [...tokenizeSteps, ...parseSteps];
    return {
        html: output.join(''),
        tokenize_steps: tokenizeSteps,
        parse_steps: parseSteps,
        all_steps: allSteps,
        step_count: allSteps.length,
        final_step: allSteps.length ? allSteps[allSteps.length - 1] : null,
    };
}

function buildVisualizationPayload(sourceText) {
    const result = parseMarkdownWithSteps(sourceText);
    return {
        source: sourceText,
        rendered_html: result.html.replace(/\n/g, '<br>\n'),
        steps: result.all_steps,
        step_count: result.step_count,
        final_step: result.final_step,
    };
}

function renderBoxList(items, formatter) {
    if (!items.length) {
        return '<div class="inline-empty">비어 있음</div>';
    }

    return '<div class="inline-box-row">' + items.map((item) => '<div class="inline-box">' + escapeHtml(formatter(item)) + '</div>').join('') + '</div>';
}

function renderStepsTable(steps) {
    if (!steps.length) {
        return '';
    }

    const rows = steps.map((step) => '<tr>' +
        '<td>' + step.step + '</td>' +
        '<td>' + renderBoxList(step.queue, (token) => token[1]) + '</td>' +
        '<td>' + renderBoxList(step.stack, (item) => item) + '</td>' +
        '<td>' + escapeHtml(step.action) + '</td>' +
        '<td>' + escapeHtml(step.output) + '</td>' +
        '</tr>').join('');

    return '<table class="steps-table"><thead><tr><th>Step</th><th>Queue 상태</th><th>Stack 상태</th><th>Action</th><th>현재 출력</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function syncTopPanelHeights() {
    sourceInput.style.height = 'auto';
    renderedView.style.minHeight = MIN_PANEL_HEIGHT + 'px';

    const contentHeight = Math.max(sourceInput.scrollHeight, renderedView.scrollHeight, MIN_PANEL_HEIGHT);
    sourceInput.style.height = contentHeight + 'px';
    renderedView.style.minHeight = contentHeight + 'px';
}

function postParentHeight() {
    if (window.parent === window) {
        return;
    }

    const nextHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
    );

    window.parent.postMessage({
        type: 'parser-js-height',
        frameId: FRAME_ID,
        height: nextHeight,
    }, window.location.origin);
}

function requestParentHeightSync() {
    if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
    }

    resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        postParentHeight();
    });
}

function applyPayload(payload) {
    renderedView.innerHTML = payload.rendered_html;
    stepsTableView.innerHTML = renderStepsTable(payload.steps);
    syncTopPanelHeights();
    requestParentHeightSync();
}

function refreshVisualization() {
    applyPayload(buildVisualizationPayload(sourceInput.value));
}

sourceInput.addEventListener('input', () => {
    syncTopPanelHeights();
    clearTimeout(updateTimer);
    updateTimer = setTimeout(refreshVisualization, 120);
});

window.addEventListener('load', requestParentHeightSync);
window.addEventListener('resize', requestParentHeightSync);

if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => {
        requestParentHeightSync();
    });
    resizeObserver.observe(document.body);
}

sourceInput.value = initialText;
applyPayload(buildVisualizationPayload(initialText));
