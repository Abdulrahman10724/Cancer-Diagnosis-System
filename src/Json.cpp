#include "../headers/Json.h"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <sstream>

const JsonValue* JsonValue::get(const std::string& key) const {
    if (type != Object) return nullptr;
    for (const auto& m : members) {
        if (m.first == key) return &m.second;
    }
    return nullptr;
}

namespace {

class Parser {
public:
    Parser(const std::string& s) : src(s), pos(0), depth(0) {}

    bool parseDocument(JsonValue& out, std::string& error) {
        skipSpace();
        if (!parseValue(out)) {
            error = message.empty() ? "Invalid JSON" : message;
            return false;
        }
        skipSpace();
        if (pos != src.size()) {
            error = "Invalid JSON: unexpected text after the value";
            return false;
        }
        return true;
    }

private:
    const std::string& src;
    size_t pos;
    int depth;
    std::string message;

    bool fail(const std::string& m) {
        if (message.empty()) message = "Invalid JSON: " + m;
        return false;
    }

    void skipSpace() {
        while (pos < src.size() && (src[pos] == ' ' || src[pos] == '\t' || src[pos] == '\n' || src[pos] == '\r')) pos++;
    }

    bool literal(const char* word) {
        size_t n = 0;
        while (word[n]) n++;
        if (src.compare(pos, n, word) != 0) return false;
        pos += n;
        return true;
    }

    bool parseValue(JsonValue& out) {
        if (++depth > 64) return fail("nested too deeply");
        skipSpace();
        if (pos >= src.size()) return fail("unexpected end");
        char c = src[pos];
        bool ok;
        if (c == '{') ok = parseObject(out);
        else if (c == '[') ok = parseArray(out);
        else if (c == '"') { out.type = JsonValue::String; ok = parseString(out.text); }
        else if (c == 't') { ok = literal("true"); out.type = JsonValue::Bool; out.boolean = true; if (!ok) fail("unknown word"); }
        else if (c == 'f') { ok = literal("false"); out.type = JsonValue::Bool; out.boolean = false; if (!ok) fail("unknown word"); }
        else if (c == 'n') { ok = literal("null"); out.type = JsonValue::Null; if (!ok) fail("unknown word"); }
        else ok = parseNumber(out);
        depth--;
        return ok;
    }

    bool parseNumber(JsonValue& out) {
        size_t start = pos;
        if (pos < src.size() && (src[pos] == '-' || src[pos] == '+')) pos++;
        bool digits = false;
        while (pos < src.size() && ((src[pos] >= '0' && src[pos] <= '9') || src[pos] == '.' ||
                                     src[pos] == 'e' || src[pos] == 'E' ||
                                     ((src[pos] == '-' || src[pos] == '+') && (src[pos - 1] == 'e' || src[pos - 1] == 'E')))) {
            if (src[pos] >= '0' && src[pos] <= '9') digits = true;
            pos++;
        }
        if (!digits) return fail("unexpected character");
        std::string token = src.substr(start, pos - start);
        char* end = nullptr;
        double v = std::strtod(token.c_str(), &end);
        if (end == token.c_str() || *end != '\0' || !std::isfinite(v)) return fail("bad number");
        out.type = JsonValue::Number;
        out.number = v;
        return true;
    }

    static void appendUtf8(std::string& s, unsigned cp) {
        if (cp < 0x80) {
            s.push_back(static_cast<char>(cp));
        } else if (cp < 0x800) {
            s.push_back(static_cast<char>(0xC0 | (cp >> 6)));
            s.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
        } else if (cp < 0x10000) {
            s.push_back(static_cast<char>(0xE0 | (cp >> 12)));
            s.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
            s.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
        } else {
            s.push_back(static_cast<char>(0xF0 | (cp >> 18)));
            s.push_back(static_cast<char>(0x80 | ((cp >> 12) & 0x3F)));
            s.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
            s.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
        }
    }

    bool hex4(unsigned& out) {
        if (pos + 4 > src.size()) return fail("bad \\u escape");
        out = 0;
        for (int i = 0; i < 4; ++i) {
            char h = src[pos++];
            out <<= 4;
            if (h >= '0' && h <= '9') out |= static_cast<unsigned>(h - '0');
            else if (h >= 'a' && h <= 'f') out |= static_cast<unsigned>(h - 'a' + 10);
            else if (h >= 'A' && h <= 'F') out |= static_cast<unsigned>(h - 'A' + 10);
            else return fail("bad \\u escape");
        }
        return true;
    }

    bool parseString(std::string& out) {
        pos++; // opening quote
        out.clear();
        while (pos < src.size()) {
            char c = src[pos++];
            if (c == '"') return true;
            if (c != '\\') {
                if (static_cast<unsigned char>(c) < 0x20) return fail("control character in string");
                out.push_back(c);
                continue;
            }
            if (pos >= src.size()) break;
            char e = src[pos++];
            switch (e) {
                case '"': out.push_back('"'); break;
                case '\\': out.push_back('\\'); break;
                case '/': out.push_back('/'); break;
                case 'b': out.push_back('\b'); break;
                case 'f': out.push_back('\f'); break;
                case 'n': out.push_back('\n'); break;
                case 'r': out.push_back('\r'); break;
                case 't': out.push_back('\t'); break;
                case 'u': {
                    unsigned cp = 0;
                    if (!hex4(cp)) return false;
                    // Surrogate pair
                    if (cp >= 0xD800 && cp <= 0xDBFF && pos + 6 <= src.size() && src[pos] == '\\' && src[pos + 1] == 'u') {
                        pos += 2;
                        unsigned lo = 0;
                        if (!hex4(lo)) return false;
                        cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
                    }
                    appendUtf8(out, cp);
                    break;
                }
                default:
                    return fail("bad escape");
            }
        }
        return fail("unterminated string");
    }

    bool parseArray(JsonValue& out) {
        out.type = JsonValue::Array;
        pos++;
        skipSpace();
        if (pos < src.size() && src[pos] == ']') { pos++; return true; }
        while (true) {
            JsonValue item;
            if (!parseValue(item)) return false;
            out.items.push_back(item);
            skipSpace();
            if (pos >= src.size()) return fail("unterminated array");
            if (src[pos] == ',') { pos++; continue; }
            if (src[pos] == ']') { pos++; return true; }
            return fail("expected , or ]");
        }
    }

    bool parseObject(JsonValue& out) {
        out.type = JsonValue::Object;
        pos++;
        skipSpace();
        if (pos < src.size() && src[pos] == '}') { pos++; return true; }
        while (true) {
            skipSpace();
            if (pos >= src.size() || src[pos] != '"') return fail("expected a key in quotes");
            std::string key;
            if (!parseString(key)) return false;
            skipSpace();
            if (pos >= src.size() || src[pos] != ':') return fail("expected :");
            pos++;
            JsonValue value;
            if (!parseValue(value)) return false;
            out.members.push_back(std::make_pair(key, value));
            skipSpace();
            if (pos >= src.size()) return fail("unterminated object");
            if (src[pos] == ',') { pos++; continue; }
            if (src[pos] == '}') { pos++; return true; }
            return fail("expected , or }");
        }
    }
};

} // namespace

bool JsonValue::parse(const std::string& input, JsonValue& out, std::string& error) {
    out = JsonValue();
    Parser p(input);
    return p.parseDocument(out, error);
}

std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", static_cast<unsigned>(static_cast<unsigned char>(c)));
                    out += buf;
                } else {
                    out.push_back(c);
                }
        }
    }
    return out;
}

std::string jsonString(const std::string& s) {
    return "\"" + jsonEscape(s) + "\"";
}

std::string jsonNumber(double value) {
    if (!std::isfinite(value)) return "null";
    std::ostringstream ss;
    ss.precision(6);
    ss << value;
    return ss.str();
}
