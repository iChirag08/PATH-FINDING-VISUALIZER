#ifndef PATHFINDER_H
#define PATHFINDER_H

#include <vector>
#include <string>
#include <cstdint>

enum class Algorithm {
    BFS = 0,
    DFS = 1,
    DIJKSTRA = 2,
    ASTAR = 3,
    GREEDY = 4,
    BIBFS = 5
};

enum class CellType : uint8_t {
    EMPTY = 0,
    WALL = 1,
    WEIGHT = 2
};

struct SearchResult {
    std::vector<int> visitOrder;
    std::vector<int> path;
    int visitedCount = 0;
    int pathLength = 0;
    double executionMs = 0.0;
    int peakMemory = 0;
    bool found = false;
};

class Pathfinder {
public:
    Pathfinder(int rows, int cols);

    void resize(int rows, int cols);
    void setWall(int row, int col, bool wall);
    void setWeight(int row, int col, int weight);
    void setStart(int row, int col);
    void setEnd(int row, int col);
    void clearWalls();
    void reset();

    SearchResult run(Algorithm algo);

    int getRows() const { return rows_; }
    int getCols() const { return cols_; }

    static std::string algorithmName(Algorithm algo);
    static std::string complexity(Algorithm algo);

private:
    int rows_, cols_;
    int startR_, startC_, endR_, endC_;
    std::vector<CellType> cells_;
    std::vector<int> weights_;

    int index(int r, int c) const;
    bool inBounds(int r, int c) const;
    bool isWalkable(int r, int c) const;
    int getCost(int r, int c) const;
    double heuristic(int r, int c) const;

    SearchResult runBFS();
    SearchResult runDFS();
    SearchResult runDijkstra();
    SearchResult runAStar();
    SearchResult runGreedy();
    SearchResult runBiBFS();

    std::vector<std::pair<int, int>> getNeighbors(int r, int c) const;
    SearchResult buildResult(
        const std::vector<int>& visitOrder,
        const std::vector<std::vector<std::pair<int, int>>>& parent,
        int startR, int startC, int endR, int endC,
        int peakMemory, double elapsedMs, bool found
    );
};

#endif
