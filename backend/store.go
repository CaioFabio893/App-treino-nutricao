package main

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Estrutura no Firestore:
//
//	users/{uid}/sessions/{1_ta}  → Session
//	users/{uid}/prs/main          → PR
//	users/{uid}/state/current     → AppState

func docKey(week int, day string) string {
	return fmt.Sprintf("%d_%s", week, day)
}

// ── Sessions ──

func (s *Server) getSession(ctx context.Context, uid string, week int, day string) (*Session, error) {
	doc, err := s.fs.Collection("users").Doc(uid).
		Collection("sessions").Doc(docKey(week, day)).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, nil
		}
		return nil, err
	}
	out := &Session{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Server) putSession(ctx context.Context, uid string, sess *Session) error {
	_, err := s.fs.Collection("users").Doc(uid).
		Collection("sessions").Doc(docKey(sess.Week, sess.Day)).Set(ctx, map[string]any{
		"week":      sess.Week,
		"day":       sess.Day,
		"exercise":  sess.Exercise,
		"updatedAt": firestore.ServerTimestamp,
	})
	return err
}

// ── PRs ──

func (s *Server) getPRs(ctx context.Context, uid string) (*PR, error) {
	doc, err := s.fs.Collection("users").Doc(uid).
		Collection("prs").Doc("main").Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, nil
		}
		return nil, err
	}
	out := &PR{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Server) putPRs(ctx context.Context, uid string, p *PR) error {
	_, err := s.fs.Collection("users").Doc(uid).
		Collection("prs").Doc("main").Set(ctx, map[string]any{
		"a": p.A, "b": p.B, "c": p.C,
		"updatedAt": firestore.ServerTimestamp,
	})
	return err
}

// ── State ──

func (s *Server) getState(ctx context.Context, uid string) (*AppState, error) {
	doc, err := s.fs.Collection("users").Doc(uid).
		Collection("state").Doc("current").Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, nil
		}
		return nil, err
	}
	out := &AppState{}
	if err := doc.DataTo(out); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Server) putState(ctx context.Context, uid string, st *AppState) error {
	_, err := s.fs.Collection("users").Doc(uid).
		Collection("state").Doc("current").Set(ctx, map[string]any{
		"week": st.Week, "day": st.Day,
		"updatedAt": firestore.ServerTimestamp,
	})
	return err
}