function findSum(N, v) {
    let result = {};
    for (let i = 0; i < N.length; i++) {
        result[N[i]] = true;
        // if remaining exist and not itself
        if (result[v - N[i]] && v - N[i] != N[i]) {
            return [v - N[i], N[i]];
        }
    }
    return -1;
}

let N = [11, 10, 3, 5, 2];
let v = 13;

console.log("Result: ", findSum(N, v));