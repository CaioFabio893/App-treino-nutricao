package middleware

import (
	"context"
	"errors"

	firebaseAuth "firebase.google.com/go/v4/auth"
)

type revocationVerifier interface {
	VerifyIDTokenAndCheckRevoked(context.Context, string) (*firebaseAuth.Token, error)
}

// FirebaseVerifier checks account deletion, disabling and session revocation,
// then enforces the password-only policy using the verified token claim.
type FirebaseVerifier struct{ client revocationVerifier }

func NewFirebaseVerifier(client revocationVerifier) *FirebaseVerifier {
	return &FirebaseVerifier{client: client}
}

func (v *FirebaseVerifier) VerifyIDToken(ctx context.Context, raw string) (*firebaseAuth.Token, error) {
	token, err := v.client.VerifyIDTokenAndCheckRevoked(ctx, raw)
	if err != nil {
		return nil, err
	}
	if token == nil || token.Firebase.SignInProvider != "password" {
		return nil, errors.New("login por senha obrigatorio")
	}
	return token, nil
}
