(function () {
    const script = document.currentScript;
    const owner = script.dataset.owner;
    const repo = script.dataset.repo;
    const branch = script.dataset.branch;

    const title = document.getElementById("page-title");
    const subtitle = document.getElementById("page-subtitle");
    const status = document.getElementById("status");
    const tree = document.getElementById("file-tree");

    function normalizePath(path) {
        return path.replace(/^\/+|\/+$/g, "");
    }

    function getRepoPath() {
        const url = new URL(window.location.href);
        if (url.protocol === "file:") {
            return null;
        }

        const cleanPath = normalizePath(url.pathname);
        const segments = cleanPath.split("/").filter(Boolean);

        if (segments[0] === repo) {
            segments.shift();
        }

        if (segments.at(-1) && segments.at(-1).includes(".")) {
            segments.pop();
        }

        return segments.join("/");
    }

    function setStatus(message, type) {
        status.textContent = message;
        status.className = "notice";

        if (type) {
            status.classList.add(`notice-${type}`);
        }

        status.hidden = !message;
    }

    function fileLabel(entry) {
        return entry.type === "dir" ? `${entry.name}/` : entry.name;
    }

    function sortEntries(entries) {
        return entries.slice().sort((left, right) => {
            if (left.type !== right.type) {
                return left.type === "dir" ? -1 : 1;
            }

            return left.name.localeCompare(right.name);
        });
    }

    async function fetchDirectory(path) {
        const endpoint = path
            ? `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`
            : `https://api.github.com/repos/${owner}/${repo}/contents?ref=${encodeURIComponent(branch)}`;

        const response = await fetch(endpoint, {
            headers: {
                Accept: "application/vnd.github+json"
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status}`);
        }

        const payload = await response.json();
        return Array.isArray(payload) ? payload : [];
    }

    async function createNode(entry) {
        const item = document.createElement("li");

        if (entry.type === "dir") {
            const folder = document.createElement("span");
            folder.className = "folder";
            folder.textContent = fileLabel(entry);
            item.appendChild(folder);

            const childTree = document.createElement("ul");
            childTree.className = "tree";
            item.appendChild(childTree);

            const children = await fetchDirectory(entry.path);
            const visibleChildren = sortEntries(children).filter((child) => child.name !== ".git");

            for (const child of visibleChildren) {
                childTree.appendChild(await createNode(child));
            }

            if (!visibleChildren.length) {
                const empty = document.createElement("li");
                empty.className = "tree-empty";
                empty.textContent = "empty/";
                childTree.appendChild(empty);
            }

            return item;
        }

        const link = document.createElement("a");
        link.className = "file";
        link.href = entry.download_url || entry.html_url || "#";
        link.textContent = fileLabel(entry);
        link.target = "_blank";
        link.rel = "noreferrer";
        item.appendChild(link);

        return item;
    }

    async function render() {
        const currentPath = getRepoPath();

        if (currentPath === null) {
            title.textContent = "Index unavailable in file mode";
            subtitle.textContent = "Open this page from a web server or GitHub Pages so script.js can request repository contents.";
            setStatus("The browser cannot read local directories directly from file:// URLs.", "error");
            return;
        }

        title.textContent = `Index of /${currentPath}`;
        subtitle.textContent = `Browsing ${owner}/${repo} on branch ${branch}`;
        setStatus("Loading files from GitHub...", "loading");

        try {
            const entries = sortEntries(await fetchDirectory(currentPath)).filter((entry) => entry.name !== ".git");
            tree.replaceChildren();

            for (const entry of entries) {
                tree.appendChild(await createNode(entry));
            }

            if (!entries.length) {
                setStatus("This directory is empty.", "info");
                return;
            }

            setStatus("", "");
        } catch (error) {
            title.textContent = "Unable to load directory";
            subtitle.textContent = `Tried to browse ${owner}/${repo} on branch ${branch}`;
            setStatus(`Failed to load repository contents: ${error.message}.`, "error");
        }
    }

    render();
})();
