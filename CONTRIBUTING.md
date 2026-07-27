# Contributing to TZANiX Q-Guard

First off, thank you for considering contributing to Q-Guard! It's people like you that make the open source community such a fantastic place to learn, inspire, and create.

## Open Core Philosophy
Q-Guard operates on an Open Core model. The core mathematical entropy generation, ATR filters, and basic TCP interception remain free and open source. 
Enterprise features (such as DB-specific deep packet inspection or ML clustering) are maintained separately. However, any improvements to the performance, security, and stability of the core proxy are highly encouraged!

## How to Contribute
1. **Fork the repository** on GitHub.
2. **Clone** your fork locally.
3. **Create a branch** for your feature or bug fix: `git checkout -b feature/your-feature-name`
4. **Make your changes**. Ensure you test them locally using the provided validation scripts in `/tests`.
5. **Commit your changes**: `git commit -m 'Add some feature'`
6. **Push to the branch**: `git push origin feature/your-feature-name`
7. **Open a Pull Request** against the `main` branch.

## Code of Conduct
Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Reporting Bugs
If you find a bug, please create a GitHub Issue detailing the steps to reproduce it, the expected behavior, and the actual behavior. Include logs from the `/tests` suite if applicable.
