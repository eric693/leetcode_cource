/* clone-graph / copy-random-list 用的 Node 類別（依題目定義巨集） */
#pragma once
#ifdef LC_GRAPH_NODE
class Node {
public:
    int val;
    vector<Node*> neighbors;
    Node() { val = 0; neighbors = vector<Node*>(); }
    Node(int _val) { val = _val; neighbors = vector<Node*>(); }
    Node(int _val, vector<Node*> _neighbors) { val = _val; neighbors = _neighbors; }
};
#endif
#ifdef LC_RANDOM_NODE
class Node {
public:
    int val;
    Node* next;
    Node* random;
    Node(int _val) { val = _val; next = NULL; random = NULL; }
};
#endif

