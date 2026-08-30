# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Signed attestation for age verification: a trusted attestation provider now
  Schnorr-signs the user's birthdate (Jubjub curve), and `verifyAge` verifies
  that signature on-chain against an admin-managed provider registry before
  running the existing age check. Closes the self-attested-birthdate fraud
  gap noted in `NOTES.md`. See `contracts/age-verify.compact`,
  `contracts/schnorr.compact`, and the new
  `src/test/age-verify.simulator.test.ts` suite.
