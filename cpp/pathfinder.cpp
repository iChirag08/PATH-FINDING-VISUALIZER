#include "pathfinder.h"
#include <queue>
#include <stack>
#include <cmath>
#include <chrono>
#include <algorithm>
#include <limits>
#include <unordered_map>
#include <unordered_set>

Pathfinder::Pathfinder(int rows, int cols) {
    resize(rows, cols);
}

void Pathfinder::resize(int rows, int cols) {
    rows_ = rows;
    cols_ = cols;
    cells_.assign(rows * cols, CellType::EMPTY);
    weights_.assign(rows * cols, 1);
    startR_ = rows / 2;
    startC_ = cols / 8;
    endR_ = rows / 2;
    endC_ = cols - cols / 8 - 1;
}

void Pathfinder::setWall(int row, int col, bool wall) {
    if (!inBounds(row, col)) return;
    if ((row == startR_ && col == startC_) || (row == endR_ && col == endC_)) return;
    cells_[index(row, col)] = wall ? CellType::WALL : CellType::EMPTY;
    if (!wall) weights_[index(row, col)] = 1;
}

void Pathfinder::setWeight(int row, int col, int weight) {
    if (!inBounds(row, col)) return;
    if ((row == startR_ && col == startC_) || (row == endR_ && col == endC_)) return;
    if (cells_[index(row, col)] == CellType::WALL) return;
    cells_[index(row, col)] = CellType::WEIGHT;
    weights_[index(row, col)] = std::max(1, weight);
}

void Pathfinder::setStart(int row, int col) {
    if (!inBounds(row, col) || !isWalkable(row, col)) return;
    startR_ = row;
    startC_ = col;
}

void Pathfinder::setEnd(int row, int col) {
    if (!inBounds(row, col) || !isWalkable(row, col)) return;
    endR_ = row;
    endC_ = col;
}

void Pathfinder::clearWalls() {
    for (int i = 0; i < rows_ * cols_; ++i) {
        cells_[i] = CellType::EMPTY;
        weights_[i] = 1;
    }
}

void Pathfinder::reset() {
    clearWalls();
    startR_ = rows_ / 2;
    startC_ = cols_ / 8;
    endR_ = rows_ / 2;
    endC_ = cols_ - cols_ / 8 - 1;
}

int Pathfinder::index(int r, int c) const {
    return r * cols_ + c;
}

bool Pathfinder::inBounds(int r, int c) const {
    return r >= 0 && r < rows_ && c >= 0 && c < cols_;
}

bool Pathfinder::isWalkable(int r, int c) const {
    return inBounds(r, c) && cells_[index(r, c)] != CellType::WALL;
}

int Pathfinder::getCost(int r, int c) const {
    return weights_[index(r, c)];
}

double Pathfinder::heuristic(int r, int c) const {
    return std::abs(r - endR_) + std::abs(c - endC_);
}

std::vector<std::pair<int, int>> Pathfinder::getNeighbors(int r, int c) const {
    static const int dr[] = {-1, 1, 0, 0};
    static const int dc[] = {0, 0, -1, 1};
    std::vector<std::pair<int, int>> neighbors;
    for (int i = 0; i < 4; ++i) {
        int nr = r + dr[i], nc = c + dc[i];
        if (isWalkable(nr, nc)) {
            neighbors.emplace_back(nr, nc);
        }
    }
    return neighbors;
}

SearchResult Pathfinder::buildResult(
    const std::vector<int>& visitOrder,
    const std::vector<std::vector<std::pair<int, int>>>& parent,
    int startR, int startC, int endR, int endC,
    int peakMemory, double elapsedMs, bool found
) {
    SearchResult result;
    result.visitOrder = visitOrder;
    result.peakMemory = peakMemory;
    result.executionMs = elapsedMs;
    result.found = found;
    result.visitedCount = static_cast<int>(visitOrder.size() / 2);

    if (found) {
        std::vector<std::pair<int, int>> pathRev;
        int r = endR, c = endC;
        pathRev.emplace_back(r, c);
        while (r != startR || c != startC) {
            auto p = parent[r][c];
            if (p.first == -1 && p.second == -1) break;
            r = p.first;
            c = p.second;
            pathRev.emplace_back(r, c);
        }
        std::reverse(pathRev.begin(), pathRev.end());
        result.pathLength = static_cast<int>(pathRev.size());
        for (const auto& pt : pathRev) {
            result.path.push_back(pt.first);
            result.path.push_back(pt.second);
        }
    }
    return result;
}

SearchResult Pathfinder::runBFS() {
    auto startTime = std::chrono::high_resolution_clock::now();

    std::vector<std::vector<std::pair<int, int>>> parent(
        rows_, std::vector<std::pair<int, int>>(cols_, {-1, -1}));
    std::vector<std::vector<bool>> visited(rows_, std::vector<bool>(cols_, false));
    std::queue<std::pair<int, int>> q;
    int peakMemory = 0;

    q.push({startR_, startC_});
    visited[startR_][startC_] = true;
    std::vector<int> visitOrder;

    while (!q.empty()) {
        peakMemory = std::max(peakMemory, static_cast<int>(q.size()));
        auto [r, c] = q.front();
        q.pop();
        visitOrder.push_back(r);
        visitOrder.push_back(c);

        if (r == endR_ && c == endC_) {
            auto endTime = std::chrono::high_resolution_clock::now();
            double ms = std::chrono::duration<double, std::milli>(endTime - startTime).count();
            return buildResult(visitOrder, parent, startR_, startC_, endR_, endC_, peakMemory, ms, true);
        }

        for (auto [nr, nc] : getNeighbors(r, c)) {
            if (!visited[nr][nc]) {
                visited[nr][nc] = true;
                parent[nr][nc] = {r, c};
                q.push({nr, nc});
            }
        }
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    double ms = std::chrono::duration<double, std::milli>(endTime - startTime).count();
    return buildResult(visitOrder, parent, startR_, startC_, endR_, endC_, peakMemory, ms, false);
}

SearchResult Pathfinder::runDFS() {
    auto startTime = std::chrono::high_resolution_clock::now();

    std::vector<std::vector<std::pair<int, int>>> parent(
        rows_, std::vector<std::pair<int, int>>(cols_, {-1, -1}));
    std::vector<std::vector<bool>> visited(rows_, std::vector<bool>(cols_, false));
    std::stack<std::pair<int, int>> st;
    int peakMemory = 0;
    bool found = false;

    st.push({startR_, startC_});
    visited[startR_][startC_] = true;
    std::vector<int> visitOrder;

    while (!st.empty()) {
        peakMemory = std::max(peakMemory, static_cast<int>(st.size()));
        auto [r, c] = st.top();
        st.pop();
        visitOrder.push_back(r);
        visitOrder.push_back(c);

        if (r == endR_ && c == endC_) {
            found = true;
            break;
        }

        auto neighbors = getNeighbors(r, c);
        std::reverse(neighbors.begin(), neighbors.end());
        for (auto [nr, nc] : neighbors) {
            if (!visited[nr][nc]) {
                visited[nr][nc] = true;
                parent[nr][nc] = {r, c};
                st.push({nr, nc});
            }
        }
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    double ms = std::chrono::duration<double, std::milli>(endTime - startTime).count();
    return buildResult(visitOrder, parent, startR_, startC_, endR_, endC_, peakMemory, ms, found);
}

SearchResult Pathfinder::runDijkstra() {
    auto startTime = std::chrono::high_resolution_clock::now();

    using State = std::tuple<int, int, int>;
    std::priority_queue<State, std::vector<State>, std::greater<State>> pq;
    std::vector<std::vector<int>> dist(rows_, std::vector<int>(cols_, std::numeric_limits<int>::max()));
    std::vector<std::vector<std::pair<int, int>>> parent(
        rows_, std::vector<std::pair<int, int>>(cols_, {-1, -1}));
    std::vector<int> visitOrder;
    int peakMemory = 0;
    bool found = false;

    dist[startR_][startC_] = 0;
    pq.push({0, startR_, startC_});

    while (!pq.empty()) {
        peakMemory = std::max(peakMemory, static_cast<int>(pq.size()));
        auto [d, r, c] = pq.top();
        pq.pop();

        if (d > dist[r][c]) continue;

        visitOrder.push_back(r);
        visitOrder.push_back(c);

        if (r == endR_ && c == endC_) {
            found = true;
            break;
        }

        for (auto [nr, nc] : getNeighbors(r, c)) {
            int newDist = d + getCost(nr, nc);
            if (newDist < dist[nr][nc]) {
                dist[nr][nc] = newDist;
                parent[nr][nc] = {r, c};
                pq.push({newDist, nr, nc});
            }
        }
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    double ms = std::chrono::duration<double, std::milli>(endTime - startTime).count();
    return buildResult(visitOrder, parent, startR_, startC_, endR_, endC_, peakMemory, ms, found);
}

SearchResult Pathfinder::runAStar() {
    auto startTime = std::chrono::high_resolution_clock::now();

    using State = std::tuple<double, int, int, int>;
    std::priority_queue<State, std::vector<State>, std::greater<State>> pq;
    std::vector<std::vector<int>> gScore(rows_, std::vector<int>(cols_, std::numeric_limits<int>::max()));
    std::vector<std::vector<std::pair<int, int>>> parent(
        rows_, std::vector<std::pair<int, int>>(cols_, {-1, -1}));
    std::vector<std::vector<bool>> closed(rows_, std::vector<bool>(cols_, false));
    std::vector<int> visitOrder;
    int peakMemory = 0;
    bool found = false;

    gScore[startR_][startC_] = 0;
    pq.push({heuristic(startR_, startC_), 0, startR_, startC_});

    while (!pq.empty()) {
        peakMemory = std::max(peakMemory, static_cast<int>(pq.size()));
        auto [f, g, r, c] = pq.top();
        pq.pop();

        if (closed[r][c]) continue;
        closed[r][c] = true;
        visitOrder.push_back(r);
        visitOrder.push_back(c);

        if (r == endR_ && c == endC_) {
            found = true;
            break;
        }

        for (auto [nr, nc] : getNeighbors(r, c)) {
            int newG = g + getCost(nr, nc);
            if (newG < gScore[nr][nc]) {
                gScore[nr][nc] = newG;
                parent[nr][nc] = {r, c};
                double fScore = newG + heuristic(nr, nc);
                pq.push({fScore, newG, nr, nc});
            }
        }
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    double ms = std::chrono::duration<double, std::milli>(endTime - startTime).count();
    return buildResult(visitOrder, parent, startR_, startC_, endR_, endC_, peakMemory, ms, found);
}

SearchResult Pathfinder::runGreedy() {
    auto startTime = std::chrono::high_resolution_clock::now();

    using State = std::tuple<double, int, int>;
    std::priority_queue<State, std::vector<State>, std::greater<State>> pq;
    std::vector<std::vector<std::pair<int, int>>> parent(
        rows_, std::vector<std::pair<int, int>>(cols_, {-1, -1}));
    std::vector<std::vector<bool>> visited(rows_, std::vector<bool>(cols_, false));
    std::vector<int> visitOrder;
    int peakMemory = 0;
    bool found = false;

    pq.push({heuristic(startR_, startC_), startR_, startC_});
    visited[startR_][startC_] = true;

    while (!pq.empty()) {
        peakMemory = std::max(peakMemory, static_cast<int>(pq.size()));
        auto [h, r, c] = pq.top();
        pq.pop();
        visitOrder.push_back(r);
        visitOrder.push_back(c);

        if (r == endR_ && c == endC_) {
            found = true;
            break;
        }

        for (auto [nr, nc] : getNeighbors(r, c)) {
            if (!visited[nr][nc]) {
                visited[nr][nc] = true;
                parent[nr][nc] = {r, c};
                pq.push({heuristic(nr, nc), nr, nc});
            }
        }
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    double ms = std::chrono::duration<double, std::milli>(endTime - startTime).count();
    return buildResult(visitOrder, parent, startR_, startC_, endR_, endC_, peakMemory, ms, found);
}

SearchResult Pathfinder::runBiBFS() {
    auto startTime = std::chrono::high_resolution_clock::now();

    std::vector<std::vector<std::pair<int, int>>> parentF(
        rows_, std::vector<std::pair<int, int>>(cols_, {-1, -1}));
    std::vector<std::vector<std::pair<int, int>>> parentB(
        rows_, std::vector<std::pair<int, int>>(cols_, {-1, -1}));
    std::vector<std::vector<bool>> visitedF(rows_, std::vector<bool>(cols_, false));
    std::vector<std::vector<bool>> visitedB(rows_, std::vector<bool>(cols_, false));

    std::queue<std::pair<int, int>> qF, qB;
    qF.push({startR_, startC_});
    qB.push({endR_, endC_});
    visitedF[startR_][startC_] = true;
    visitedB[endR_][endC_] = true;

    std::vector<int> visitOrder;
    int peakMemory = 0;
    bool found = false;
    int meetR = -1, meetC = -1;

    while (!qF.empty() && !qB.empty()) {
        peakMemory = std::max(peakMemory, static_cast<int>(qF.size() + qB.size()));

        // Forward step
        int sizeF = static_cast<int>(qF.size());
        for (int i = 0; i < sizeF; ++i) {
            auto [r, c] = qF.front();
            qF.pop();
            visitOrder.push_back(r);
            visitOrder.push_back(c);

            if (visitedB[r][c]) {
                meetR = r;
                meetC = c;
                found = true;
                goto done;
            }

            for (auto [nr, nc] : getNeighbors(r, c)) {
                if (!visitedF[nr][nc]) {
                    visitedF[nr][nc] = true;
                    parentF[nr][nc] = {r, c};
                    qF.push({nr, nc});
                }
            }
        }

        // Backward step
        int sizeB = static_cast<int>(qB.size());
        for (int i = 0; i < sizeB; ++i) {
            auto [r, c] = qB.front();
            qB.pop();
            visitOrder.push_back(r);
            visitOrder.push_back(c);

            if (visitedF[r][c]) {
                meetR = r;
                meetC = c;
                found = true;
                goto done;
            }

            for (auto [nr, nc] : getNeighbors(r, c)) {
                if (!visitedB[nr][nc]) {
                    visitedB[nr][nc] = true;
                    parentB[nr][nc] = {r, c};
                    qB.push({nr, nc});
                }
            }
        }
    }

done:
    auto endTime = std::chrono::high_resolution_clock::now();
    double ms = std::chrono::duration<double, std::milli>(endTime - startTime).count();

    SearchResult result;
    result.visitOrder = visitOrder;
    result.peakMemory = peakMemory;
    result.executionMs = ms;
    result.found = found;
    result.visitedCount = static_cast<int>(visitOrder.size() / 2);

    if (found) {
        std::vector<std::pair<int, int>> pathF, pathB;
        int r = meetR, c = meetC;
        pathF.emplace_back(r, c);
        while (r != startR_ || c != startC_) {
            auto p = parentF[r][c];
            if (p.first == -1) break;
            r = p.first;
            c = p.second;
            pathF.emplace_back(r, c);
        }
        std::reverse(pathF.begin(), pathF.end());

        r = meetR;
        c = meetC;
        if (!(r == endR_ && c == endC_)) {
            auto p = parentB[r][c];
            r = p.first;
            c = p.second;
        }
        while (r != endR_ || c != endC_) {
            pathB.emplace_back(r, c);
            auto p = parentB[r][c];
            if (p.first == -1) break;
            r = p.first;
            c = p.second;
        }

        for (const auto& pt : pathF) {
            result.path.push_back(pt.first);
            result.path.push_back(pt.second);
        }
        for (const auto& pt : pathB) {
            result.path.push_back(pt.first);
            result.path.push_back(pt.second);
        }
        result.pathLength = static_cast<int>(pathF.size() + pathB.size() - 1);
    }

    return result;
}

SearchResult Pathfinder::run(Algorithm algo) {
    switch (algo) {
        case Algorithm::BFS: return runBFS();
        case Algorithm::DFS: return runDFS();
        case Algorithm::DIJKSTRA: return runDijkstra();
        case Algorithm::ASTAR: return runAStar();
        case Algorithm::GREEDY: return runGreedy();
        case Algorithm::BIBFS: return runBiBFS();
        default: return runBFS();
    }
}

std::string Pathfinder::algorithmName(Algorithm algo) {
    switch (algo) {
        case Algorithm::BFS: return "Breadth-First Search";
        case Algorithm::DFS: return "Depth-First Search";
        case Algorithm::DIJKSTRA: return "Dijkstra's Algorithm";
        case Algorithm::ASTAR: return "A* Search";
        case Algorithm::GREEDY: return "Greedy Best-First";
        case Algorithm::BIBFS: return "Bidirectional BFS";
        default: return "Unknown";
    }
}

std::string Pathfinder::complexity(Algorithm algo) {
    switch (algo) {
        case Algorithm::BFS: return "O(V + E)";
        case Algorithm::DFS: return "O(V + E)";
        case Algorithm::DIJKSTRA: return "O(E log V)";
        case Algorithm::ASTAR: return "O(E log V)";
        case Algorithm::GREEDY: return "O(E log V)";
        case Algorithm::BIBFS: return "O(b^(d/2))";
        default: return "O(?)";
    }
}
