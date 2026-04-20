package game

import (
	"crypto/rand"
	"encoding/binary"
)

func rand_int(max int) int {
	var b [8]byte
	rand.Read(b[:])
	return int(binary.LittleEndian.Uint64(b[:]) % uint64(max))
}

func Random_Seat() int {
	return rand_int(4)
}
