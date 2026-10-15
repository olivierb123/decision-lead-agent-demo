from __future__ import annotations

from agent_framework_foundry_hosting import ResponsesHostServer
from dotenv import load_dotenv

from synergy_agent import build_synergy_agent

load_dotenv()


def main() -> None:
    agent = build_synergy_agent()
    server = ResponsesHostServer(agent)
    server.run()


if __name__ == "__main__":
    main()
