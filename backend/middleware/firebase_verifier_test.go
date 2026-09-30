package middleware

import (
	"context"
	"errors"
	"testing"

	firebaseAuth "firebase.google.com/go/v4/auth"
)

type revocationStub struct {
	token  *firebaseAuth.Token
	err    error
	called bool
}

func (s *revocationStub) VerifyIDTokenAndCheckRevoked(context.Context, string) (*firebaseAuth.Token, error) {
	s.called = true
	return s.token, s.err
}

func TestFirebaseVerifierPasswordOnly(t *testing.T) {
	for _, provider := range []string{"password", "google.com", "anonymous", "custom", ""} {
		t.Run(provider, func(t *testing.T) {
			s := &revocationStub{token: &firebaseAuth.Token{UID: "uid", Firebase: firebaseAuth.FirebaseInfo{SignInProvider: provider}}}
			token, err := NewFirebaseVerifier(s).VerifyIDToken(context.Background(), "raw")
			if !s.called {
				t.Fatal("revocation check skipped")
			}
			if provider == "password" {
				if err != nil || token.UID != "uid" {
					t.Fatal("password token rejected")
				}
			} else if err == nil || token != nil {
				t.Fatal("non-password token accepted")
			}
		})
	}
}

func TestFirebaseVerifierRejectsRevokedDisabledOrDeleted(t *testing.T) {
	for _, reason := range []string{"revoked", "disabled", "deleted"} {
		t.Run(reason, func(t *testing.T) {
			expected := errors.New(reason)
			s := &revocationStub{err: expected}
			token, err := NewFirebaseVerifier(s).VerifyIDToken(context.Background(), "raw")
			if !s.called || !errors.Is(err, expected) || token != nil {
				t.Fatal("account rejection not preserved")
			}
		})
	}
}
