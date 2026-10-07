package handlers

import (
	"bytes"
	"image"
	"image/png"
	"testing"
)

func TestPageRejectsOversizedPagesBeforeDecode(t *testing.T) {
	for _, bounds := range []image.Rectangle{image.Rect(0, 0, 2501, 1), image.Rect(0, 0, 2001, 2000)} {
		var b bytes.Buffer
		if err := png.Encode(&b, image.NewGray(bounds)); err != nil {
			t.Fatal(err)
		}
		if _, err := validatePage(b.Bytes()); err == nil {
			t.Fatalf("accepted bounds %v", bounds)
		}
	}
	if _, err := validatePage(make([]byte, (16<<20)+1)); err == nil {
		t.Fatal("accepted oversized bytes")
	}
	if _, err := validatePage([]byte("invalid png")); err == nil {
		t.Fatal("accepted invalid image")
	}
}
