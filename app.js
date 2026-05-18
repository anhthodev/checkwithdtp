/* ================= DOM ================= */

const source = document.getElementById("source");
const target = document.getElementById("target");

const compareBtn = document.getElementById("compare");
const resetBtn = document.getElementById("reset");

const result = document.getElementById("result");
const stats = document.getElementById("stats");

const layoutToggle =
    document.getElementById("layoutToggle");

const editorGrid =
    document.querySelector(".editor-grid");

const loading =
    document.getElementById("loading");

/* ================= MODAL ================= */

const modal =
    document.getElementById("confirmModal");

const cancelDelete =
    document.getElementById("cancelDelete");

const confirmDelete =
    document.getElementById("confirmDelete");

/* ================= STATE ================= */

let allErrors = [];

let currentPage = 1;

let errorsPerPage = 5;

/* ================= SAVE ================= */

source.value =
    localStorage.getItem("sourceText") || "";

target.value =
    localStorage.getItem("targetText") || "";

source.addEventListener("input", () => {

    localStorage.setItem(
        "sourceText",
        source.value
    );
});

target.addEventListener("input", () => {

    localStorage.setItem(
        "targetText",
        target.value
    );
});

/* ================= LAYOUT ================= */

layoutToggle.onclick = () => {

    const isSingle =
        editorGrid.classList.toggle("single");

    layoutToggle.innerHTML =
        isSingle ? "📊" : "📐";
};

/* ================= UTIL ================= */

function randomIcon(){

    const icons = [
        "🤡",
        "💀",
        "👹",
        "🐸",
        "👻"
    ];

    return icons[
        Math.floor(
            Math.random() * icons.length
        )
    ];
}

function escapeHtml(text){

    return (text || "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;");
}

/* ================= EXCEL STYLE ================= */

function normalizeText(text){

    return (text || "")

        /* remove CR */
        .replace(/\r/g,"")

        /* remove LF */
        .replace(/\n/g,"")

        /* remove TAB */
        .replace(/\t/g,"")

        /* remove full-width space JP */
        .replace(/　/g,"")

        /* remove normal spaces */
        .replace(/ /g,"")

        /* normalize unicode */
        .normalize("NFC");
}

function safeRender(text){

    return escapeHtml(text || "")

        .replace(/\r/g,"")
        .replace(/\n/g,"")
        .replace(/\t/g,"");
}

/* ================= IGNORE SWAP ================= */

/*
    Ví dụ:

    original = *[
    target   = [*

    => bỏ qua không báo lỗi
*/

function isSwapPair(a1,a2,b1,b2){

    return (
        a1 === b2 &&
        a2 === b1
    );
}

/* ================= DIFF ================= */

function diff(a,b){

    const result = [];

    let i = 0;
    let j = 0;

    const MAX_LOOKAHEAD = 25;

    function resync(i,j){

        for(let k=1;k<MAX_LOOKAHEAD;k++){

            if(a[i + k] === b[j]){

                return {
                    type:"missing",
                    step:k
                };
            }

            if(a[i] === b[j + k]){

                return {
                    type:"extra",
                    step:k
                };
            }
        }

        return null;
    }

    while(
        i < a.length &&
        j < b.length
    ){

        /* SAME */

        if(a[i] === b[j]){

            result.push({
                type:"same",
                char:a[i]
            });

            i++;
            j++;

            continue;
        }

        /* ================= IGNORE REVERSED ================= */

        /*
            *[
            [*

            hoặc bất kỳ 2 ký tự đảo nhau
        */

        if(
            i + 1 < a.length &&
            j + 1 < b.length &&
            isSwapPair(
                a[i],
                a[i + 1],
                b[j],
                b[j + 1]
            )
        ){

            result.push({
                type:"same",
                char:a[i]
            });

            result.push({
                type:"same",
                char:a[i + 1]
            });

            i += 2;
            j += 2;

            continue;
        }

        /* ================= RESYNC ================= */

        const fix = resync(i,j);

        if(fix){

            if(fix.type === "missing"){

                for(
                    let k=0;
                    k<fix.step;
                    k++
                ){

                    result.push({
                        type:"missing",
                        char:a[i + k],
                        pos:i + k + 1
                    });
                }

                i += fix.step;

                continue;
            }

            if(fix.type === "extra"){

                for(
                    let k=0;
                    k<fix.step;
                    k++
                ){

                    result.push({
                        type:"extra",
                        char:b[j + k],
                        pos:j + k + 1
                    });
                }

                j += fix.step;

                continue;
            }
        }

        /* ================= REPLACE ================= */

        result.push({
            type:"replace",
            from:a[i],
            to:b[j],
            pos:i + 1
        });

        i++;
        j++;
    }

    while(j < b.length){

        result.push({
            type:"extra",
            char:b[j],
            pos:j + 1
        });

        j++;
    }

    while(i < a.length){

        result.push({
            type:"missing",
            char:a[i],
            pos:i + 1
        });

        i++;
    }

    return result;
}

/* ================= COMPARE ================= */

compareBtn.onclick = () => {

    loading.classList.remove("hidden");

    setTimeout(() => {

        const original =
            normalizeText(source.value);

        const test =
            normalizeText(target.value);

        compareText(original,test);

        loading.classList.add("hidden");

    },150);
};

function compareText(original,test){

    const diffs = diff(original,test);

    let html = "";

    allErrors = [];

    currentPage = 1;

    let correct = 0;
    let total = 0;

    diffs.forEach(d => {

        /* SAME */

        if(d.type === "same"){

            html += safeRender(d.char);

            correct++;
            total++;
        }

        /* EXTRA */

        if(d.type === "extra"){

            html +=
                `<span class="error-char" data-pos="${d.pos}">` +
                `${safeRender(d.char)}` +
                `</span>`;

            allErrors.push({
                type:"extra",
                text:
                    `${randomIcon()} Dư "` +
                    `${safeRender(d.char)}"`,
                pos:d.pos
            });

            total++;
        }

        /* MISSING */

        if(d.type === "missing"){

            html +=
                `<span class="missing-char" data-pos="${d.pos}"></span>`;

            allErrors.push({
                type:"missing",
                text:
                    `${randomIcon()} Thiếu "` +
                    `${safeRender(d.char)}"`,
                pos:d.pos
            });

            total++;
        }

        /* REPLACE */

        if(d.type === "replace"){

            html +=
                `<span class="error-char" data-pos="${d.pos}">` +
                `${safeRender(d.to)}` +
                `</span>`;

            allErrors.push({
                type:"replace",
                text:
                    `${randomIcon()} "` +
                    `${safeRender(d.from)}` +
                    `" → "` +
                    `${safeRender(d.to)}"`,

                pos:d.pos
            });

            total++;
        }
    });

    /* ================= SORT ================= */

    const priority = {
        missing:1,
        extra:2,
        replace:3
    };

    allErrors.sort(
        (a,b) =>
            priority[a.type] -
            priority[b.type]
    );

    /* ================= ACCURACY ================= */

    const percent =
        total
            ? Math.round(
                (correct / total) * 100
            )
            : 0;

    result.innerHTML = html;

    stats.innerHTML =
        `<div>Accuracy: ${percent}%</div>` +

        `<div class="error-list">` +

        (
            allErrors.length

                ? allErrors.map(e =>

                    `<div class="error-item" onclick="jumpToError(${e.pos})">` +
                    `<pre>${e.text}</pre>` +
                    `</div>`

                ).join("")

                : "🎉 Không có lỗi"
        )

        +

        `</div>`;
}

/* ================= JUMP ================= */

window.jumpToError = function(pos){

    target.focus();

    target.setSelectionRange(
        pos - 1,
        pos
    );

    const el =
        document.querySelector(
            `[data-pos="${pos}"]`
        );

    if(el){

        el.scrollIntoView({
            behavior:"smooth",
            block:"center"
        });
    }
};

/* ================= RESET ================= */

resetBtn.onclick = () => {
    modal.classList.remove("hidden");
};

cancelDelete.onclick = () => {
    modal.classList.add("hidden");
};

confirmDelete.onclick = () => {

    source.value = "";
    target.value = "";

    result.innerHTML = "";

    stats.innerHTML =
        "Accuracy: 0%";

    allErrors = [];

    localStorage.clear();

    modal.classList.add("hidden");
};

modal.onclick = (e) => {

    if(e.target === modal){

        modal.classList.add("hidden");
    }
};

/* ================= THEME ================= */

const themeToggle =
    document.getElementById("themeToggle");

const themeToggleSticky =
    document.getElementById("themeToggleSticky");

/* load saved theme */

const savedTheme =
    localStorage.getItem("theme") || "dark";

document.body.classList.toggle(
    "dark",
    savedTheme === "dark"
);

updateThemeIcon();

/* toggle */

function toggleTheme(){

    document.body.classList.toggle("dark");

    const isDark =
        document.body.classList.contains("dark");

    localStorage.setItem(
        "theme",
        isDark ? "dark" : "light"
    );

    updateThemeIcon();
}

/* icon */

function updateThemeIcon(){

    const isDark =
        document.body.classList.contains("dark");

    const icon =
        isDark ? "☀️" : "🌙";

    themeToggle.innerHTML = icon;

    if(themeToggleSticky){

        themeToggleSticky.innerHTML = icon;
    }
}

/* event */

themeToggle.onclick = toggleTheme;

if(themeToggleSticky){

    themeToggleSticky.onclick =
        toggleTheme;
}